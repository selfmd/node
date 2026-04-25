import { EventEmitter } from 'node:events';
import { createId } from '@paralleldrive/cuid2';
import { deriveKey, SenderKeys, fingerprintFromPublicKey, } from '@networkselfmd/core';
import { MessageType } from '@networkselfmd/core';
import { sha256 } from 'hash-wasm';
const KEY_ROTATION_INTERVAL = 100;
export class GroupManager extends EventEmitter {
    identity;
    swarm;
    groupRepo;
    messageRepo;
    senderKeyRepo;
    peerRepo;
    messageCounters = new Map();
    constructor(options) {
        super();
        this.identity = options.identity;
        this.swarm = options.swarm;
        this.groupRepo = options.groups;
        this.messageRepo = options.messages;
        this.senderKeyRepo = options.senderKeys;
        this.peerRepo = options.peers;
    }
    async createGroup(name) {
        const timestamp = Date.now();
        const nonce = crypto.getRandomValues(new Uint8Array(32));
        // groupId = sha256(edPublicKey || uint64BE(timestamp) || nonce32)
        const input = new Uint8Array(this.identity.edPublicKey.length + 8 + nonce.length);
        input.set(this.identity.edPublicKey, 0);
        const tsView = new DataView(input.buffer, input.byteOffset + this.identity.edPublicKey.length, 8);
        tsView.setBigUint64(0, BigInt(timestamp), false);
        input.set(nonce, this.identity.edPublicKey.length + 8);
        const hashHex = await sha256(input);
        const groupId = hexToBytes(hashHex);
        // Derive topic via HKDF
        const topic = deriveKey(groupId, 'networkselfmd-topic-v1', '', 32);
        this.groupRepo.create(groupId, name, 'admin');
        // Add self as member
        this.groupRepo.addMember(groupId, this.identity.edPublicKey, 'admin');
        // Generate sender key
        const senderKeyState = SenderKeys.generate();
        this.senderKeyRepo.store(groupId, this.identity.edPublicKey, senderKeyState.chainKey, senderKeyState.chainIndex);
        // Join swarm topic
        await this.swarm.join(Buffer.from(topic));
        // Distribute sender keys to already-connected peers
        await this.distributeSenderKeys(groupId);
        this.emit('group:created', { groupId, name, topic });
        return { groupId, topic: Buffer.from(topic) };
    }
    async joinGroup(groupId, name = 'Unknown Group') {
        const topic = deriveKey(groupId, 'networkselfmd-topic-v1', '', 32);
        this.groupRepo.join(groupId, name, 'member');
        // Add self as member
        this.groupRepo.addMember(groupId, this.identity.edPublicKey, 'member');
        // Generate our sender key
        const senderKeyState = SenderKeys.generate();
        this.senderKeyRepo.store(groupId, this.identity.edPublicKey, senderKeyState.chainKey, senderKeyState.chainIndex);
        await this.swarm.join(Buffer.from(topic));
        // Register any peers whose sender keys we already received for this group
        const existingKeys = this.senderKeyRepo.listForGroup(groupId);
        for (const key of existingKeys) {
            const pk = new Uint8Array(key.public_key);
            if (!buffersEqual(pk, this.identity.edPublicKey)) {
                this.groupRepo.addMember(groupId, pk, 'member');
            }
        }
        // Distribute sender keys to already-connected peers
        await this.distributeSenderKeys(groupId);
        this.emit('group:joined', { groupId, name });
    }
    async leaveGroup(groupId) {
        const topic = deriveKey(groupId, 'networkselfmd-topic-v1', '', 32);
        await this.swarm.leave(Buffer.from(topic));
        this.groupRepo.leave(groupId);
        this.senderKeyRepo.deleteForGroup(groupId);
        this.messageCounters.delete(Buffer.from(groupId).toString('hex'));
        this.emit('group:left', { groupId });
    }
    async inviteToGroup(groupId, peerPublicKey) {
        const group = this.groupRepo.find(groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        const peerFingerprint = fingerprintFromPublicKey(peerPublicKey);
        const session = this.swarm.getSession(peerFingerprint);
        if (!session) {
            throw new Error('Peer not connected');
        }
        const message = {
            type: MessageType.GroupManagement,
            action: 'invite',
            groupId,
            targetFingerprint: peerFingerprint,
            groupName: group.name,
            timestamp: Date.now(),
        };
        session.send(message);
        this.groupRepo.addMember(groupId, peerPublicKey, 'member');
        this.emit('group:invited', { groupId, peerPublicKey });
    }
    async kickFromGroup(groupId, memberPublicKey) {
        const group = this.groupRepo.find(groupId);
        if (!group || group.role !== 'admin') {
            throw new Error('Not authorized to kick members');
        }
        // Send kick message to all members
        const members = this.groupRepo.getMembers(groupId);
        const memberFingerprint = fingerprintFromPublicKey(memberPublicKey);
        const kickMessage = {
            type: MessageType.GroupManagement,
            action: 'kick',
            groupId,
            targetFingerprint: memberFingerprint,
            timestamp: Date.now(),
        };
        for (const member of members) {
            const fp = fingerprintFromPublicKey(new Uint8Array(member.public_key));
            const session = this.swarm.getSession(fp);
            if (session) {
                session.send(kickMessage);
            }
        }
        this.groupRepo.removeMember(groupId, memberPublicKey);
        this.senderKeyRepo.delete(groupId, memberPublicKey);
        // Rotate keys after kick
        await this.rotateKeys(groupId);
        this.emit('group:memberLeft', { groupId, memberPublicKey });
    }
    async distributeSenderKeys(groupId) {
        const senderKey = this.senderKeyRepo.load(groupId, this.identity.edPublicKey);
        if (!senderKey)
            return;
        const distribution = SenderKeys.createDistribution(groupId, {
            chainKey: new Uint8Array(senderKey.chain_key),
            chainIndex: senderKey.chain_index,
        }, this.identity.edPublicKey);
        const message = distribution;
        // Send to all connected peers (not just known members).
        // Peers that share this group will store the key; others will ignore it.
        const allSessions = this.swarm.getAllSessions();
        for (const session of allSessions) {
            if (session.peerPublicKey && !buffersEqual(session.peerPublicKey, this.identity.edPublicKey)) {
                try {
                    session.send(message);
                }
                catch {
                    // Ignore send errors (session may have closed)
                }
            }
        }
    }
    handleSenderKeyDistribution(message) {
        // Store the sender key regardless of group membership.
        // This handles the case where a peer distributes keys before we join
        // the group -- we'll have the key ready when we do join.
        this.senderKeyRepo.store(message.groupId, message.signingPublicKey, message.chainKey, message.chainIndex);
        // If we are a member of this group, register the sender as a member
        const group = this.groupRepo.find(message.groupId);
        if (group) {
            this.groupRepo.addMember(message.groupId, message.signingPublicKey, 'member');
        }
    }
    async handleGroupMessage(session, message) {
        if (!session.peerPublicKey)
            return;
        const senderKey = this.senderKeyRepo.load(message.groupId, session.peerPublicKey);
        if (!senderKey) {
            this.emit('error', new Error('No sender key for peer'));
            return;
        }
        try {
            const record = {
                chainKey: new Uint8Array(senderKey.chain_key),
                chainIndex: senderKey.chain_index,
                skippedKeys: new Map(),
            };
            const { plaintext, nextRecord } = SenderKeys.decrypt(record, message.chainIndex, message.nonce, message.ciphertext);
            // Update stored key state
            this.senderKeyRepo.store(message.groupId, session.peerPublicKey, nextRecord.chainKey, nextRecord.chainIndex);
            const content = new TextDecoder().decode(plaintext);
            this.messageRepo.insert({
                id: createId(),
                groupId: message.groupId,
                senderPublicKey: session.peerPublicKey,
                content,
                timestamp: message.timestamp ?? Date.now(),
                type: 'group',
            });
            this.emit('group:message', {
                groupId: message.groupId,
                senderPublicKey: session.peerPublicKey,
                senderFingerprint: session.peerFingerprint,
                content,
                timestamp: message.timestamp,
            });
        }
        catch (err) {
            this.emit('error', err);
        }
    }
    async sendGroupMessage(groupId, content) {
        const senderKey = this.senderKeyRepo.load(groupId, this.identity.edPublicKey);
        if (!senderKey) {
            throw new Error('No sender key for this group');
        }
        const plaintext = new TextEncoder().encode(content);
        const state = {
            chainKey: new Uint8Array(senderKey.chain_key),
            chainIndex: senderKey.chain_index,
        };
        const { ciphertext, nonce, chainIndex: encChainIndex, nextState } = SenderKeys.encrypt(state, plaintext);
        // Update stored key state
        this.senderKeyRepo.store(groupId, this.identity.edPublicKey, nextState.chainKey, nextState.chainIndex);
        const messageId = createId();
        const message = {
            type: MessageType.GroupMessage,
            groupId,
            senderFingerprint: this.identity.fingerprint,
            chainIndex: encChainIndex,
            ciphertext,
            nonce,
            timestamp: Date.now(),
        };
        // Send to all connected members
        const members = this.groupRepo.getMembers(groupId);
        for (const member of members) {
            const memberKey = new Uint8Array(member.public_key);
            if (buffersEqual(memberKey, this.identity.edPublicKey))
                continue;
            const fp = fingerprintFromPublicKey(memberKey);
            const session = this.swarm.getSession(fp);
            if (session) {
                session.send(message);
            }
        }
        // Store own message
        this.messageRepo.insert({
            id: messageId,
            groupId,
            senderPublicKey: this.identity.edPublicKey,
            content,
            timestamp: Date.now(),
            type: 'group',
        });
        // Check key rotation
        const groupHex = Buffer.from(groupId).toString('hex');
        const count = (this.messageCounters.get(groupHex) ?? 0) + 1;
        this.messageCounters.set(groupHex, count);
        if (count >= KEY_ROTATION_INTERVAL) {
            await this.rotateKeys(groupId);
            this.messageCounters.set(groupHex, 0);
        }
    }
    async rotateKeys(groupId) {
        const newState = SenderKeys.generate();
        this.senderKeyRepo.store(groupId, this.identity.edPublicKey, newState.chainKey, newState.chainIndex);
        await this.distributeSenderKeys(groupId);
        this.emit('group:keysRotated', { groupId });
    }
    handleGroupManagement(session, message) {
        if (!session.peerPublicKey)
            return;
        switch (message.action) {
            case 'invite':
                this.emit('group:invited', {
                    groupId: message.groupId,
                    invitedBy: session.peerPublicKey,
                    groupName: message.groupName,
                });
                break;
            case 'kick':
                if (message.targetFingerprint &&
                    message.targetFingerprint === this.identity.fingerprint) {
                    // We were kicked
                    this.leaveGroup(message.groupId).catch((err) => {
                        this.emit('error', err);
                    });
                }
                else if (message.targetFingerprint) {
                    // We don't have the public key from just the fingerprint,
                    // but we can look up members to find and remove the right one
                    const members = this.groupRepo.getMembers(message.groupId);
                    for (const member of members) {
                        const memberKey = new Uint8Array(member.public_key);
                        const fp = fingerprintFromPublicKey(memberKey);
                        if (fp === message.targetFingerprint) {
                            this.groupRepo.removeMember(message.groupId, memberKey);
                            this.senderKeyRepo.delete(message.groupId, memberKey);
                            break;
                        }
                    }
                    this.emit('group:memberLeft', {
                        groupId: message.groupId,
                        targetFingerprint: message.targetFingerprint,
                    });
                }
                break;
        }
    }
    async rejoinAllGroups() {
        const groups = this.groupRepo.list();
        for (const group of groups) {
            const groupId = new Uint8Array(group.group_id);
            const topic = deriveKey(groupId, 'networkselfmd-topic-v1', '', 32);
            await this.swarm.join(Buffer.from(topic));
        }
    }
}
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
function buffersEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
//# sourceMappingURL=group-manager.js.map
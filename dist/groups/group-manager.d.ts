import { EventEmitter } from 'node:events';
import type { AgentIdentity, GroupEncryptedMessage, SenderKeyDistributionMessage, GroupManagementMessage } from '@networkselfmd/core';
import type { PeerSession } from '../network/connection.js';
import type { SwarmManager } from '../network/swarm.js';
import type { GroupRepository, MessageRepository, SenderKeyRepository, PeerRepository } from '../storage/repositories.js';
export interface GroupManagerOptions {
    identity: AgentIdentity;
    swarm: SwarmManager;
    groups: GroupRepository;
    messages: MessageRepository;
    senderKeys: SenderKeyRepository;
    peers: PeerRepository;
}
export declare class GroupManager extends EventEmitter {
    private identity;
    private swarm;
    private groupRepo;
    private messageRepo;
    private senderKeyRepo;
    private peerRepo;
    private messageCounters;
    constructor(options: GroupManagerOptions);
    createGroup(name: string): Promise<{
        groupId: Uint8Array;
        topic: Buffer;
    }>;
    joinGroup(groupId: Uint8Array, name?: string): Promise<void>;
    leaveGroup(groupId: Uint8Array): Promise<void>;
    inviteToGroup(groupId: Uint8Array, peerPublicKey: Uint8Array): Promise<void>;
    kickFromGroup(groupId: Uint8Array, memberPublicKey: Uint8Array): Promise<void>;
    distributeSenderKeys(groupId: Uint8Array): Promise<void>;
    handleSenderKeyDistribution(message: SenderKeyDistributionMessage): void;
    handleGroupMessage(session: PeerSession, message: GroupEncryptedMessage): Promise<void>;
    sendGroupMessage(groupId: Uint8Array, content: string): Promise<void>;
    rotateKeys(groupId: Uint8Array): Promise<void>;
    handleGroupManagement(session: PeerSession, message: GroupManagementMessage): void;
    rejoinAllGroups(): Promise<void>;
}
//# sourceMappingURL=group-manager.d.ts.map
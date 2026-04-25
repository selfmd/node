import type Database from 'better-sqlite3';
export interface StoredIdentity {
    id: number;
    ed_private_key: Buffer;
    ed_public_key: Buffer;
    display_name: string | null;
    created_at: number;
}
export interface StoredPeer {
    public_key: Buffer;
    fingerprint: string;
    display_name: string | null;
    trusted: number;
    last_seen: number | null;
}
export interface StoredGroup {
    group_id: Buffer;
    name: string;
    role: string;
    created_at: number;
    joined_at: number | null;
    is_public: number;
    self_md: string | null;
}
export interface StoredGroupMember {
    group_id: Buffer;
    public_key: Buffer;
    role: string;
}
export interface StoredMessage {
    id: string;
    group_id: Buffer | null;
    sender_public_key: Buffer | null;
    peer_public_key: Buffer | null;
    content: string;
    timestamp: number;
    type: string;
}
export interface StoredSenderKey {
    group_id: Buffer;
    public_key: Buffer;
    chain_key: Buffer;
    chain_index: number;
}
export interface StoredKeyData {
    id: number;
    salt: Buffer;
    nonce: Buffer;
    ciphertext: Buffer;
}
export interface MessageQueryOptions {
    groupId?: Uint8Array;
    peerPublicKey?: Uint8Array;
    limit?: number;
    before?: string;
}
export declare class IdentityRepository {
    private db;
    constructor(db: Database.Database);
    save(edPrivateKey: Uint8Array, edPublicKey: Uint8Array, displayName?: string): void;
    load(): StoredIdentity | undefined;
    saveEncryptedKeys(salt: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): void;
    loadEncryptedKeys(): StoredKeyData | undefined;
}
export declare class PeerRepository {
    private db;
    constructor(db: Database.Database);
    upsert(publicKey: Uint8Array, fingerprint: string, displayName?: string): void;
    find(publicKey: Uint8Array): StoredPeer | undefined;
    list(): StoredPeer[];
    trust(publicKey: Uint8Array): void;
    untrust(publicKey: Uint8Array): void;
    updateLastSeen(publicKey: Uint8Array): void;
}
export declare class GroupRepository {
    private db;
    constructor(db: Database.Database);
    create(groupId: Uint8Array, name: string, role?: string): void;
    join(groupId: Uint8Array, name: string, role?: string): void;
    leave(groupId: Uint8Array): void;
    find(groupId: Uint8Array): StoredGroup | undefined;
    list(): StoredGroup[];
    addMember(groupId: Uint8Array, publicKey: Uint8Array, role?: string): void;
    removeMember(groupId: Uint8Array, publicKey: Uint8Array): void;
    getMembers(groupId: Uint8Array): StoredGroupMember[];
    setPublic(groupId: Uint8Array, isPublic: boolean, selfMd?: string): void;
    listPublic(): StoredGroup[];
}
export declare class MessageRepository {
    private db;
    constructor(db: Database.Database);
    insert(message: {
        id: string;
        groupId?: Uint8Array;
        senderPublicKey?: Uint8Array;
        peerPublicKey?: Uint8Array;
        content: string;
        timestamp: number;
        type: string;
    }): void;
    query(options: MessageQueryOptions): StoredMessage[];
}
export interface StoredDiscoveredGroup {
    group_id: Buffer;
    name: string;
    self_md: string | null;
    member_count: number;
    announced_by: Buffer;
    last_announced: number;
}
export declare class DiscoveredGroupRepository {
    private db;
    constructor(db: Database.Database);
    upsert(groupId: Uint8Array, name: string, selfMd: string | undefined, memberCount: number, announcedBy: Uint8Array): void;
    list(): StoredDiscoveredGroup[];
    find(groupId: Uint8Array): StoredDiscoveredGroup | undefined;
    remove(groupId: Uint8Array): void;
}
export declare class SenderKeyRepository {
    private db;
    constructor(db: Database.Database);
    store(groupId: Uint8Array, publicKey: Uint8Array, chainKey: Uint8Array, chainIndex: number): void;
    load(groupId: Uint8Array, publicKey: Uint8Array): StoredSenderKey | undefined;
    delete(groupId: Uint8Array, publicKey: Uint8Array): void;
    listForGroup(groupId: Uint8Array): StoredSenderKey[];
    deleteForGroup(groupId: Uint8Array): void;
}
//# sourceMappingURL=repositories.d.ts.map
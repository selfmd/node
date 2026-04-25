export class IdentityRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    save(edPrivateKey, edPublicKey, displayName) {
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO identity (id, ed_private_key, ed_public_key, display_name, created_at)
       VALUES (1, ?, ?, ?, ?)`);
        stmt.run(Buffer.from(edPrivateKey), Buffer.from(edPublicKey), displayName ?? null, Date.now());
    }
    load() {
        return this.db
            .prepare('SELECT * FROM identity WHERE id = 1')
            .get();
    }
    saveEncryptedKeys(salt, nonce, ciphertext) {
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO key_storage (id, salt, nonce, ciphertext)
       VALUES (1, ?, ?, ?)`);
        stmt.run(Buffer.from(salt), Buffer.from(nonce), Buffer.from(ciphertext));
    }
    loadEncryptedKeys() {
        return this.db
            .prepare('SELECT * FROM key_storage WHERE id = 1')
            .get();
    }
}
export class PeerRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    upsert(publicKey, fingerprint, displayName) {
        const stmt = this.db.prepare(`INSERT INTO peers (public_key, fingerprint, display_name, last_seen)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(public_key) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         display_name = COALESCE(excluded.display_name, peers.display_name),
         last_seen = excluded.last_seen`);
        stmt.run(Buffer.from(publicKey), fingerprint, displayName ?? null, Date.now());
    }
    find(publicKey) {
        return this.db
            .prepare('SELECT * FROM peers WHERE public_key = ?')
            .get(Buffer.from(publicKey));
    }
    list() {
        return this.db.prepare('SELECT * FROM peers ORDER BY last_seen DESC').all();
    }
    trust(publicKey) {
        this.db
            .prepare('UPDATE peers SET trusted = 1 WHERE public_key = ?')
            .run(Buffer.from(publicKey));
    }
    untrust(publicKey) {
        this.db
            .prepare('UPDATE peers SET trusted = 0 WHERE public_key = ?')
            .run(Buffer.from(publicKey));
    }
    updateLastSeen(publicKey) {
        this.db
            .prepare('UPDATE peers SET last_seen = ? WHERE public_key = ?')
            .run(Date.now(), Buffer.from(publicKey));
    }
}
export class GroupRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(groupId, name, role = 'admin') {
        const now = Date.now();
        const stmt = this.db.prepare(`INSERT INTO groups (group_id, name, role, created_at, joined_at)
       VALUES (?, ?, ?, ?, ?)`);
        stmt.run(Buffer.from(groupId), name, role, now, now);
    }
    join(groupId, name, role = 'member') {
        const now = Date.now();
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO groups (group_id, name, role, created_at, joined_at)
       VALUES (?, ?, ?, ?, ?)`);
        stmt.run(Buffer.from(groupId), name, role, now, now);
    }
    leave(groupId) {
        this.db.prepare('DELETE FROM groups WHERE group_id = ?').run(Buffer.from(groupId));
        this.db.prepare('DELETE FROM group_members WHERE group_id = ?').run(Buffer.from(groupId));
        this.db.prepare('DELETE FROM sender_keys WHERE group_id = ?').run(Buffer.from(groupId));
    }
    find(groupId) {
        return this.db
            .prepare('SELECT * FROM groups WHERE group_id = ?')
            .get(Buffer.from(groupId));
    }
    list() {
        return this.db.prepare('SELECT * FROM groups ORDER BY joined_at DESC').all();
    }
    addMember(groupId, publicKey, role = 'member') {
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO group_members (group_id, public_key, role)
       VALUES (?, ?, ?)`);
        stmt.run(Buffer.from(groupId), Buffer.from(publicKey), role);
    }
    removeMember(groupId, publicKey) {
        this.db
            .prepare('DELETE FROM group_members WHERE group_id = ? AND public_key = ?')
            .run(Buffer.from(groupId), Buffer.from(publicKey));
    }
    getMembers(groupId) {
        return this.db
            .prepare('SELECT * FROM group_members WHERE group_id = ?')
            .all(Buffer.from(groupId));
    }
    setPublic(groupId, isPublic, selfMd) {
        this.db
            .prepare('UPDATE groups SET is_public = ?, self_md = COALESCE(?, self_md) WHERE group_id = ?')
            .run(isPublic ? 1 : 0, selfMd ?? null, Buffer.from(groupId));
    }
    listPublic() {
        return this.db
            .prepare('SELECT * FROM groups WHERE is_public = 1')
            .all();
    }
}
export class MessageRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    insert(message) {
        const stmt = this.db.prepare(`INSERT OR IGNORE INTO messages (id, group_id, sender_public_key, peer_public_key, content, timestamp, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(message.id, message.groupId ? Buffer.from(message.groupId) : null, message.senderPublicKey ? Buffer.from(message.senderPublicKey) : null, message.peerPublicKey ? Buffer.from(message.peerPublicKey) : null, message.content, message.timestamp, message.type);
    }
    query(options) {
        const conditions = [];
        const params = [];
        if (options.groupId) {
            conditions.push('group_id = ?');
            params.push(Buffer.from(options.groupId));
        }
        if (options.peerPublicKey) {
            conditions.push('(sender_public_key = ? OR peer_public_key = ?)');
            params.push(Buffer.from(options.peerPublicKey), Buffer.from(options.peerPublicKey));
        }
        if (options.before) {
            conditions.push('id < ?');
            params.push(options.before);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = options.limit ?? 50;
        return this.db
            .prepare(`SELECT * FROM messages ${where} ORDER BY timestamp DESC LIMIT ?`)
            .all(...params, limit);
    }
}
export class DiscoveredGroupRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    upsert(groupId, name, selfMd, memberCount, announcedBy) {
        const stmt = this.db.prepare(`INSERT INTO discovered_groups (group_id, name, self_md, member_count, announced_by, last_announced)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(group_id) DO UPDATE SET
         name = excluded.name,
         self_md = COALESCE(excluded.self_md, discovered_groups.self_md),
         member_count = excluded.member_count,
         announced_by = excluded.announced_by,
         last_announced = excluded.last_announced`);
        stmt.run(Buffer.from(groupId), name, selfMd ?? null, memberCount, Buffer.from(announcedBy), Date.now());
    }
    list() {
        return this.db
            .prepare('SELECT * FROM discovered_groups ORDER BY last_announced DESC')
            .all();
    }
    find(groupId) {
        return this.db
            .prepare('SELECT * FROM discovered_groups WHERE group_id = ?')
            .get(Buffer.from(groupId));
    }
    remove(groupId) {
        this.db.prepare('DELETE FROM discovered_groups WHERE group_id = ?').run(Buffer.from(groupId));
    }
}
export class SenderKeyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    store(groupId, publicKey, chainKey, chainIndex) {
        const stmt = this.db.prepare(`INSERT OR REPLACE INTO sender_keys (group_id, public_key, chain_key, chain_index)
       VALUES (?, ?, ?, ?)`);
        stmt.run(Buffer.from(groupId), Buffer.from(publicKey), Buffer.from(chainKey), chainIndex);
    }
    load(groupId, publicKey) {
        return this.db
            .prepare('SELECT * FROM sender_keys WHERE group_id = ? AND public_key = ?')
            .get(Buffer.from(groupId), Buffer.from(publicKey));
    }
    delete(groupId, publicKey) {
        this.db
            .prepare('DELETE FROM sender_keys WHERE group_id = ? AND public_key = ?')
            .run(Buffer.from(groupId), Buffer.from(publicKey));
    }
    listForGroup(groupId) {
        return this.db
            .prepare('SELECT * FROM sender_keys WHERE group_id = ?')
            .all(Buffer.from(groupId));
    }
    deleteForGroup(groupId) {
        this.db
            .prepare('DELETE FROM sender_keys WHERE group_id = ?')
            .run(Buffer.from(groupId));
    }
}
//# sourceMappingURL=repositories.js.map
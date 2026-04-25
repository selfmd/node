import { EventEmitter } from 'node:events';
import Hyperswarm from 'hyperswarm';
import { performHandshake } from './handshake.js';
import { MessageRouter } from './router.js';
export class SwarmManager extends EventEmitter {
    swarm = null;
    sessions = new Map();
    topics = new Set();
    identity;
    bootstrap;
    router;
    constructor(options) {
        super();
        this.identity = options.identity;
        this.bootstrap = options.bootstrap;
        this.router = new MessageRouter();
    }
    async start() {
        const swarmOpts = {};
        if (this.bootstrap) {
            swarmOpts.bootstrap = this.bootstrap;
        }
        this.swarm = new Hyperswarm(swarmOpts);
        this.swarm.on('connection', (socket, peerInfo) => {
            this.handleConnection(socket, peerInfo).catch((err) => {
                this.emit('error', err);
            });
        });
    }
    async handleConnection(socket, _peerInfo) {
        try {
            const result = await performHandshake(socket, this.identity);
            const { session, peerFingerprint } = result;
            // Store session by fingerprint
            const existingSession = this.sessions.get(peerFingerprint);
            if (existingSession) {
                existingSession.close();
            }
            this.sessions.set(peerFingerprint, session);
            // Set up message routing BEFORE emitting events or replaying
            // buffered messages, to prevent dropping messages.
            session.on('message', (message) => {
                this.router.route(session, message).catch((err) => {
                    this.emit('error', err);
                });
            });
            session.on('close', () => {
                this.sessions.delete(peerFingerprint);
                this.emit('peer:disconnected', {
                    peerPublicKey: result.peerPublicKey,
                    peerFingerprint,
                });
            });
            session.on('error', (err) => {
                this.emit('error', err);
            });
            session.setReady();
            this.emit('peer:connected', result);
            this.emit('peer:verified', result);
            // Replay any messages that arrived during the handshake
            if (result.bufferedMessages) {
                for (const msg of result.bufferedMessages) {
                    this.router.route(session, msg).catch((err) => {
                        this.emit('error', err);
                    });
                }
            }
        }
        catch (err) {
            this.emit('error', err);
        }
    }
    async join(topic) {
        if (!this.swarm) {
            throw new Error('Swarm not started');
        }
        const topicHex = topic.toString('hex');
        if (this.topics.has(topicHex)) {
            return;
        }
        const discovery = this.swarm.join(topic, { server: true, client: true });
        await discovery.flushed();
        this.topics.add(topicHex);
    }
    async leave(topic) {
        if (!this.swarm)
            return;
        const topicHex = topic.toString('hex');
        if (!this.topics.has(topicHex))
            return;
        await this.swarm.leave(topic);
        this.topics.delete(topicHex);
    }
    getSession(fingerprint) {
        return this.sessions.get(fingerprint);
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    getSessionCount() {
        return this.sessions.size;
    }
    async stop() {
        for (const session of this.sessions.values()) {
            session.close();
        }
        this.sessions.clear();
        this.topics.clear();
        if (this.swarm) {
            await this.swarm.destroy();
            this.swarm = null;
        }
    }
}
//# sourceMappingURL=swarm.js.map
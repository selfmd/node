import { EventEmitter } from 'node:events';
import type { AgentIdentity } from '@networkselfmd/core';
import { PeerSession } from './connection.js';
import { MessageRouter } from './router.js';
export interface SwarmManagerOptions {
    identity: AgentIdentity;
    bootstrap?: Array<{
        host: string;
        port: number;
    }>;
}
export declare class SwarmManager extends EventEmitter {
    private swarm;
    private sessions;
    private topics;
    private identity;
    private bootstrap?;
    readonly router: MessageRouter;
    constructor(options: SwarmManagerOptions);
    start(): Promise<void>;
    private handleConnection;
    join(topic: Buffer): Promise<void>;
    leave(topic: Buffer): Promise<void>;
    getSession(fingerprint: string): PeerSession | undefined;
    getAllSessions(): PeerSession[];
    getSessionCount(): number;
    stop(): Promise<void>;
}
//# sourceMappingURL=swarm.d.ts.map
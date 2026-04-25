import { EventEmitter } from 'node:events';
import type { AgentIdentity, PeerInfo, GroupInfo } from '@networkselfmd/core';
import type { PeerSession } from './network/connection.js';
export interface AgentOptions {
    dataDir: string;
    passphrase?: string;
    displayName?: string;
    bootstrap?: Array<{
        host: string;
        port: number;
    }>;
}
export interface MemberInfo {
    publicKey: Uint8Array;
    fingerprint: string;
    role: string;
    displayName?: string;
}
export interface Message {
    id: string;
    groupId?: Uint8Array;
    senderPublicKey?: Uint8Array;
    peerPublicKey?: Uint8Array;
    content: string;
    timestamp: number;
    type: string;
}
export declare class Agent extends EventEmitter {
    identity: AgentIdentity;
    peers: Map<string, PeerSession>;
    groups: Map<string, GroupInfo>;
    isRunning: boolean;
    private options;
    private database;
    private identityRepo;
    private peerRepo;
    private groupRepo;
    private messageRepo;
    private senderKeyRepo;
    private discoveredGroupRepo;
    private swarm;
    private groupManager;
    constructor(options: AgentOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    createGroup(name: string, options?: {
        public?: boolean;
        selfMd?: string;
    }): Promise<{
        groupId: Uint8Array;
        topic: Buffer;
    }>;
    inviteToGroup(groupId: string, peerPublicKey: string): Promise<void>;
    joinGroup(groupId: string): Promise<void>;
    leaveGroup(groupId: string): Promise<void>;
    kickFromGroup(groupId: string, memberPublicKey: string): Promise<void>;
    listGroups(): GroupInfo[];
    getGroupMembers(groupId: string): MemberInfo[];
    sendGroupMessage(groupId: string, content: string): Promise<void>;
    sendDirectMessage(peerPublicKey: string, content: string): Promise<void>;
    getMessages(opts: {
        groupId?: string;
        peerPublicKey?: string;
        limit?: number;
        before?: string;
    }): Message[];
    listPeers(): PeerInfo[];
    trustPeer(peerPublicKey: string): void;
    untrustPeer(peerPublicKey: string): void;
    makeGroupPublic(groupId: string, selfMd: string): void;
    listDiscoveredGroups(): Array<{
        groupId: Uint8Array;
        name: string;
        selfMd: string | null;
        memberCount: number;
    }>;
    joinPublicGroup(groupId: string): Promise<void>;
    private announcePublicGroups;
    private loadOrGenerateIdentity;
    private setupSwarmEvents;
    private setupRouterHandlers;
    private setupGroupManagerEvents;
    private handleDirectMessage;
}
//# sourceMappingURL=agent.d.ts.map
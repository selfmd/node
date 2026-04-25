import { EventEmitter } from 'node:events';
import type { ProtocolMessage } from '@networkselfmd/core';
export type ConnectionState = 'connecting' | 'handshaking' | 'verified' | 'ready' | 'closed';
export declare class PeerSession extends EventEmitter {
    readonly socket: {
        write: (data: Uint8Array) => boolean;
        end: () => void;
        destroy: () => void;
        on: (event: string, handler: (...args: unknown[]) => void) => void;
        removeAllListeners: (event?: string) => void;
        remotePublicKey?: Buffer;
    };
    state: ConnectionState;
    peerPublicKey: Uint8Array | null;
    peerFingerprint: string | null;
    peerDisplayName: string | null;
    noisePublicKey: Uint8Array | null;
    private buffer;
    constructor(socket: {
        write: (data: Uint8Array) => boolean;
        end: () => void;
        destroy: () => void;
        on: (event: string, handler: (...args: unknown[]) => void) => void;
        removeAllListeners: (event?: string) => void;
        remotePublicKey?: Buffer;
    });
    private onData;
    send(message: ProtocolMessage): void;
    close(): void;
    setVerified(peerPublicKey: Uint8Array, peerFingerprint: string, peerDisplayName?: string): void;
    setReady(): void;
}
//# sourceMappingURL=connection.d.ts.map
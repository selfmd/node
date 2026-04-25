import type { AgentIdentity, ProtocolMessage } from '@networkselfmd/core';
import { PeerSession } from './connection.js';
export interface HandshakeResult {
    session: PeerSession;
    peerPublicKey: Uint8Array;
    peerFingerprint: string;
    peerDisplayName?: string;
    /** Messages that arrived during the handshake but were not handshake messages */
    bufferedMessages?: ProtocolMessage[];
}
export declare function performHandshake(socket: ConstructorParameters<typeof PeerSession>[0], identity: AgentIdentity): Promise<HandshakeResult>;
//# sourceMappingURL=handshake.d.ts.map
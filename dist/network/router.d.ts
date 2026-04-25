import type { ProtocolMessage } from '@networkselfmd/core';
import type { PeerSession } from './connection.js';
export type MessageHandler = (session: PeerSession, message: ProtocolMessage) => void | Promise<void>;
export declare class MessageRouter {
    private handlers;
    on(messageType: number, handler: MessageHandler): void;
    off(messageType: number, handler: MessageHandler): void;
    route(session: PeerSession, message: ProtocolMessage): Promise<void>;
}
//# sourceMappingURL=router.d.ts.map
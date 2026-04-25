import { EventEmitter } from 'node:events';
import { frameMessage, parseFrame, } from '@networkselfmd/core';
export class PeerSession extends EventEmitter {
    socket;
    state = 'connecting';
    peerPublicKey = null;
    peerFingerprint = null;
    peerDisplayName = null;
    noisePublicKey = null;
    buffer = Buffer.alloc(0);
    constructor(socket) {
        super();
        this.socket = socket;
        this.noisePublicKey = socket.remotePublicKey
            ? new Uint8Array(socket.remotePublicKey)
            : null;
        this.socket.on('data', ((...args) => {
            this.onData(args[0]);
        }));
        this.socket.on('error', ((...args) => {
            const err = args[0];
            // ECONNRESET is expected during teardown — treat as close, not error
            if (err.code === 'ECONNRESET') {
                if (this.state !== 'closed') {
                    this.state = 'closed';
                    this.emit('close');
                }
                return;
            }
            this.emit('error', err);
        }));
        this.socket.on('close', () => {
            this.state = 'closed';
            this.emit('close');
        });
        this.socket.on('end', () => {
            this.state = 'closed';
            this.emit('close');
        });
    }
    onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length > 0) {
            try {
                const result = parseFrame(new Uint8Array(this.buffer));
                if (!result) {
                    // Not enough data yet
                    return;
                }
                const { message, bytesConsumed } = result;
                this.buffer = Buffer.from(this.buffer.subarray(bytesConsumed));
                this.emit('message', message);
            }
            catch (err) {
                // Clear the corrupted buffer so future messages can still be parsed.
                // Without this, the bad data stays in the buffer and every subsequent
                // onData call fails immediately.
                this.buffer = Buffer.alloc(0);
                this.emit('error', err);
                return;
            }
        }
    }
    send(message) {
        if (this.state === 'closed') {
            throw new Error('Cannot send on closed session');
        }
        const framed = frameMessage(message);
        this.socket.write(framed);
    }
    close() {
        if (this.state !== 'closed') {
            this.state = 'closed';
            try {
                this.socket.end();
            }
            catch {
                // ignore
            }
            this.emit('close');
        }
    }
    setVerified(peerPublicKey, peerFingerprint, peerDisplayName) {
        this.peerPublicKey = peerPublicKey;
        this.peerFingerprint = peerFingerprint;
        this.peerDisplayName = peerDisplayName ?? null;
        this.state = 'verified';
    }
    setReady() {
        if (this.state === 'verified') {
            this.state = 'ready';
        }
    }
}
//# sourceMappingURL=connection.js.map
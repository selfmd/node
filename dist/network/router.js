export class MessageRouter {
    handlers = new Map();
    on(messageType, handler) {
        const existing = this.handlers.get(messageType) ?? [];
        existing.push(handler);
        this.handlers.set(messageType, existing);
    }
    off(messageType, handler) {
        const existing = this.handlers.get(messageType);
        if (!existing)
            return;
        const idx = existing.indexOf(handler);
        if (idx !== -1) {
            existing.splice(idx, 1);
        }
    }
    async route(session, message) {
        const handlers = this.handlers.get(message.type);
        if (!handlers || handlers.length === 0) {
            return;
        }
        for (const handler of handlers) {
            try {
                await handler(session, message);
            }
            catch (err) {
                // Emit error on session for upstream handling
                session.emit('routeError', err, message);
            }
        }
    }
}
//# sourceMappingURL=router.js.map
import Database from 'better-sqlite3';
export declare class AgentDatabase {
    private db;
    constructor(dataDir: string);
    migrate(): void;
    private getSchemaVersion;
    getDb(): Database.Database;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map
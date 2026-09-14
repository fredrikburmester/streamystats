import { db } from "./connection";
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;
export type UserMergeInput = {
    sourceUserId: string;
    targetUserId: string;
};
export declare class UserMergeError extends Error {
    readonly status: number;
    constructor(message: string, status?: number);
}
export declare function runUserMergeTransaction<T>({ serverId, database, run, }: {
    serverId: number;
    database: Reader;
    run: (tx: Transaction) => Promise<T>;
}): Promise<T>;
export declare function getMergedUserTarget({ serverId, userId, database, }: {
    serverId: number;
    userId: string;
    database?: Reader;
}): Promise<string | null>;
export declare function getMergeAccounts({ serverId, database, }: {
    serverId: number;
    database?: Reader;
}): Promise<{
    id: string;
    name: string;
    lastActivityDate: Date | null;
}[]>;
export declare function getRetiredUserIds({ serverId, database, }: {
    serverId: number;
    database?: Reader;
}): Promise<string[]>;
export declare function previewUserMerge({ serverId, input, database, }: {
    serverId: number;
    input: UserMergeInput;
    database?: Reader;
}): Promise<{
    source: {
        id: string;
        name: string;
    };
    target: {
        id: string;
        name: string;
    };
    transferred: Record<string, number>;
    watchTime: number;
    token: string;
}>;
export declare function mergeUsersPermanently({ serverId, input, previewToken, operationId, actor, database, }: {
    serverId: number;
    input: UserMergeInput;
    previewToken: string;
    operationId: string;
    actor: {
        id: string;
        name: string;
    };
    database?: Reader;
}): Promise<{
    targetUserId: string;
    transferred: Record<string, number>;
}>;
export {};
//# sourceMappingURL=user-merge.d.ts.map
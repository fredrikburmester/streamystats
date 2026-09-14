import { type SQL, type AnyColumn } from "drizzle-orm";
import { db } from "./connection";
import { type UserGroupSnapshot } from "./schema";
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;
export declare class UserGroupError extends Error {
    readonly status: number;
    constructor(message: string, status?: number);
}
export type UserGroupChange = {
    groupId: string | null;
    primaryUserId: string;
    memberUserIds: string[];
    expectedRevision: number | null;
};
export type UserGroupAccount = {
    id: string;
    name: string;
    lastActivityDate: Date | null;
    excluded: boolean;
    groupId: string | null;
};
export type UserGroupPreview = {
    change: UserGroupChange;
    before: UserGroupSnapshot | null;
    members: UserGroupAccount[];
    sessionCount: number;
    watchTime: number;
    token: string;
};
export declare function getUserGroups({ serverId, database, }: {
    serverId: number;
    database?: Reader;
}): Promise<UserGroupSnapshot[]>;
export declare function getUserGroupAccounts({ serverId, database, }: {
    serverId: number;
    database?: Reader;
}): Promise<UserGroupAccount[]>;
export declare function resolveAnalyticsUser({ serverId, userId, database, }: {
    serverId: number;
    userId: string;
    database?: Reader;
}): Promise<{
    primaryUserId: string;
    memberUserIds: string[];
    group: UserGroupSnapshot | null;
}>;
export declare function analyticsUserScope(userId: string | number, options?: {
    viewerUserId?: string;
    serverId?: number | string;
}): SQL;
export declare function analyticsSessionVisibility({ viewerUserId, }?: {
    viewerUserId?: string;
}): SQL;
export declare function analyticsUserId({ userId, serverId, }?: {
    userId?: AnyColumn;
    serverId?: AnyColumn;
}): SQL<string>;
export declare function previewUserGroup({ serverId, change, database, }: {
    serverId: number;
    change: UserGroupChange;
    database?: Reader;
}): Promise<UserGroupPreview>;
export declare function changeUserGroup({ serverId, change, previewToken, operationId, actor, database, }: {
    serverId: number;
    change: UserGroupChange;
    previewToken: string;
    operationId: string;
    actor: {
        id: string;
        name: string;
    };
    database?: Database;
}): Promise<UserGroupSnapshot | null>;
export {};
//# sourceMappingURL=user-groups.d.ts.map
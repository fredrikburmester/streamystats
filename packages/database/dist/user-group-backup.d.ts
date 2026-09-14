import { db } from "./connection";
export type UserGroupsBackup = {
    accounts: {
        id: string;
        name: string;
    }[];
    groups: {
        primaryUserId: string;
        memberUserIds: string[];
    }[];
};
export declare function exportUserGroups({ serverId, database, }: {
    serverId: number;
    database?: typeof db;
}): Promise<UserGroupsBackup>;
export declare function restoreUserGroups({ serverId, backup, actor, database, }: {
    serverId: number;
    backup: UserGroupsBackup;
    actor: {
        id: string;
        name: string;
    };
    database?: typeof db;
}): Promise<void>;
//# sourceMappingURL=user-group-backup.d.ts.map
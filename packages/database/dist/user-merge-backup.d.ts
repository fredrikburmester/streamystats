import { db } from "./connection";
export type UserMergeBackup = {
    retiredUsers: {
        sourceUserId: string;
        sourceName: string;
        targetUserId: string;
    }[];
    accounts: {
        id: string;
        name: string;
    }[];
};
export declare function exportMergedUserData({ serverId, database, }: {
    serverId: number;
    database?: typeof db;
}): Promise<{
    sessions: {
        id: string;
        serverId: number;
        userId: string | null;
        itemId: string | null;
        userName: string;
        userServerId: string | null;
        deviceId: string | null;
        deviceName: string | null;
        clientName: string | null;
        applicationVersion: string | null;
        remoteEndPoint: string | null;
        itemName: string | null;
        seriesId: string | null;
        seriesName: string | null;
        seasonId: string | null;
        playDuration: number | null;
        startTime: Date | null;
        endTime: Date | null;
        lastActivityDate: Date | null;
        lastPlaybackCheckIn: Date | null;
        runtimeTicks: number | null;
        positionTicks: number | null;
        percentComplete: number | null;
        completed: boolean;
        isPaused: boolean;
        isMuted: boolean;
        isActive: boolean;
        volumeLevel: number | null;
        audioStreamIndex: number | null;
        subtitleStreamIndex: number | null;
        playMethod: string | null;
        mediaSourceId: string | null;
        repeatMode: string | null;
        playbackOrder: string | null;
        videoCodec: string | null;
        audioCodec: string | null;
        resolutionWidth: number | null;
        resolutionHeight: number | null;
        videoBitRate: number | null;
        audioBitRate: number | null;
        audioChannels: number | null;
        audioSampleRate: number | null;
        videoRangeType: string | null;
        isInferred: boolean;
        isTranscoded: boolean;
        transcodingWidth: number | null;
        transcodingHeight: number | null;
        transcodingVideoCodec: string | null;
        transcodingAudioCodec: string | null;
        transcodingContainer: string | null;
        transcodingIsVideoDirect: boolean | null;
        transcodingIsAudioDirect: boolean | null;
        transcodingBitrate: number | null;
        transcodingCompletionPercentage: number | null;
        transcodingAudioChannels: number | null;
        transcodingHardwareAccelerationType: string | null;
        transcodeReasons: string[] | null;
        rawData: unknown;
        createdAt: Date;
        updatedAt: Date;
    }[];
    hiddenRecommendations: {
        id: number;
        serverId: number;
        userId: string;
        itemId: string;
        createdAt: Date;
    }[];
    userMerges: {
        retiredUsers: {
            sourceUserId: string;
            sourceName: string;
            targetUserId: string;
        }[];
        accounts: {
            id: string;
            name: string;
        }[];
    };
}>;
export declare function restoreUserMerges({ serverId, backup, actor, database, }: {
    serverId: number;
    backup: UserMergeBackup;
    actor: {
        id: string;
        name: string;
    };
    database?: typeof db;
}): Promise<void>;
//# sourceMappingURL=user-merge-backup.d.ts.map
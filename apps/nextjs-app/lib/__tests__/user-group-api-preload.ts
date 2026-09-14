import { mock } from "bun:test";

export const state = {
  role: "admin",
  mutations: 0,
  scopedServer: 0,
  expired: false,
  conflict: false,
  actorId: "admin",
};
class UserGroupError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
mock.module("@/lib/api-auth", () => ({
  requireAdmin: async (serverId: number) => {
    state.scopedServer = serverId;
    const status =
      state.role === "anonymous"
        ? 401
        : state.role !== "admin" || serverId !== 1
          ? 403
          : 0;
    return status
      ? { error: Response.json({}, { status }), session: null }
      : {
          error: null,
          session: {
            id: state.actorId,
            name: "Admin",
            isAdmin: true,
            serverId: 1,
          },
        };
  },
}));
mock.module("@streamystats/database", () => ({
  UserGroupError,
  getUserGroupAccounts: async () => [],
  getUserGroups: async () => [],
  previewUserGroup: async () => ({
    token: "a".repeat(64),
    sessionCount: 2,
    watchTime: 50,
  }),
  changeUserGroup: async () => {
    if (state.conflict) throw new UserGroupError("Preview expired.", 409);
    state.mutations++;
    return null;
  },
}));
mock.module("next/cache", () => ({
  revalidateTag: (tag: string, options: { expire: number }) => {
    state.expired = tag === "user-analytics" && options.expire === 0;
  },
  revalidatePath() {},
}));

import { mock } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({
  cacheLife() {},
  cacheTag() {},
  revalidateTag() {},
  revalidatePath() {},
}));

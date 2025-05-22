import { atomWithStorage } from "jotai/utils";
import { Server } from "../db";

export const serverAtom = atomWithStorage<Server | null>(
  "selectedServer",
  null
);

// Store the preferred server ID that should be used as default
export const preferredServerIdAtom = atomWithStorage<number | null>(
  "preferredServerId",
  null
);

// Store custom server order (array of server IDs)
export const serverOrderAtom = atomWithStorage<number[]>("serverOrder", []);

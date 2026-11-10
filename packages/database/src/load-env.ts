// Side-effect entry point: import it first in a process so *_FILE secrets are
// resolved into process.env before any other module reads them.
import { loadFileEnv } from "./env";

loadFileEnv();

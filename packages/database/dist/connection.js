"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.db = exports.client = exports.getDb = exports.getClient = exports.getDatabaseUrl = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const dotenv = __importStar(require("dotenv"));
const schema = __importStar(require("./schema"));
// Ensure environment variables are loaded
dotenv.config({ quiet: true });
const getDatabaseUrl = () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        // Important: if the connection string is missing, postgres-js falls back to
        // PG* env vars and then the OS user. In root-run containers that becomes
        // "root", leading to confusing errors like: `FATAL: role "root" does not exist`.
        throw new Error('DATABASE_URL environment variable is missing. Set DATABASE_URL (e.g. "postgresql://postgres:postgres@host:5432/streamystats").');
    }
    return databaseUrl;
};
exports.getDatabaseUrl = getDatabaseUrl;
const globalForDatabase = globalThis;
// Lazily create the postgres client (avoid connecting during Next.js build/SSG)
const getClient = () => {
    if (!globalForDatabase.streamystatsClient) {
        globalForDatabase.streamystatsClient = (0, postgres_1.default)((0, exports.getDatabaseUrl)(), {
            max: 20, // Maximum number of connections in the pool
            idle_timeout: 20, // Close connections after 20 seconds of inactivity
            max_lifetime: 60 * 30, // Maximum lifetime of a connection (30 minutes)
            connect_timeout: 60,
            connection: {
                // Filtered vector searches (by item type, excluding watched items)
                // otherwise only see the index's first ~40 candidates, so a seed whose
                // nearest neighbours are of another type returns almost nothing.
                // pgvector >= 0.8; older versions drop the unknown setting.
                "hnsw.iterative_scan": "strict_order",
            },
        });
    }
    return globalForDatabase.streamystatsClient;
};
exports.getClient = getClient;
// Lazily create Drizzle database instance
const getDb = () => {
    if (!globalForDatabase.streamystatsDb) {
        globalForDatabase.streamystatsDb = (0, postgres_js_1.drizzle)((0, exports.getClient)(), { schema });
    }
    return globalForDatabase.streamystatsDb;
};
exports.getDb = getDb;
// Backwards-compatible exports: these do NOT touch env/DB until first use.
exports.client = new Proxy((() => { }), {
    apply(_target, thisArg, args) {
        return (0, exports.getClient)().apply(thisArg, args);
    },
    get(_target, prop) {
        return (0, exports.getClient)()[prop];
    },
});
exports.db = new Proxy({}, {
    get(_target, prop) {
        return (0, exports.getDb)()[prop];
    },
});
// Graceful shutdown helper
const closeConnection = async () => {
    try {
        if (globalForDatabase.streamystatsClient) {
            await globalForDatabase.streamystatsClient.end();
            globalForDatabase.streamystatsClient = undefined;
            globalForDatabase.streamystatsDb = undefined;
        }
    }
    catch (error) {
        console.error("Error closing database connection:", error);
    }
};
exports.closeConnection = closeConnection;
exports.default = exports.db;
//# sourceMappingURL=connection.js.map
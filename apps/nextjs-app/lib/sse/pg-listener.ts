import { resolveDatabaseUrl } from "@streamystats/database/env";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require("postgres");

export interface JobEvent {
  id: string;
  name: string;
  state: "created" | "active" | "completed" | "failed" | "expired";
  serverId: string;
  createdOn: string;
  completedOn: string | null;
}

export type JobEventHandler = (event: JobEvent) => void;

/**
 * PostgreSQL LISTEN/NOTIFY listener singleton
 * Maintains a persistent connection to receive job events
 */
interface PostgresConnection {
  listen: (
    channel: string,
    callback: (payload: string) => void,
  ) => Promise<void>;
  end: () => Promise<void>;
}

class PgListener {
  private sql: PostgresConnection | null = null;
  private handlers: Set<JobEventHandler> = new Set();
  private isListening = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Initialize the listener connection
   */
  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isListening) {
      return;
    }

    this.connectionPromise = this.doConnect();
    await this.connectionPromise;
    this.connectionPromise = null;
  }

  private async doConnect(): Promise<void> {
    try {
      const connectionString = resolveDatabaseUrl();
      if (!connectionString) {
        console.error("[pg-listener] database connection is not configured");
        return;
      }

      // Create a dedicated connection for LISTEN (separate from query pool)
      const sql: PostgresConnection = postgres(connectionString, {
        max: 1, // Single connection for LISTEN
        idle_timeout: 0, // Never timeout
        connect_timeout: 10,
      });
      this.sql = sql;

      // Start listening
      await sql.listen("job_events", (payload) => {
        this.handleNotification(payload);
      });

      this.isListening = true;
      console.info("[pg-listener] Connected and listening for job_events");
    } catch (error) {
      console.error("[pg-listener] Connection failed:", error);
      this.scheduleReconnect();
    }
  }

  private handleNotification(payload: string): void {
    try {
      const event = JSON.parse(payload) as JobEvent;
      console.info(
        `[pg-listener] Received: ${event.name} state=${event.state} serverId=${event.serverId}`,
      );

      // Notify all handlers
      for (const handler of this.handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error("[pg-listener] Handler error:", err);
        }
      }
    } catch (err) {
      console.error("[pg-listener] Failed to parse notification:", err);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.isListening = false;
    console.info("[pg-listener] Scheduling reconnect in 5 seconds...");

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      await this.connect();
    }, 5000);
  }

  /**
   * Subscribe to job events
   * @returns Unsubscribe function
   */
  subscribe(handler: JobEventHandler): () => void {
    this.handlers.add(handler);

    // Ensure we're connected
    if (!this.isListening && !this.connectionPromise) {
      this.connect().catch(console.error);
    }

    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get current connection status
   */
  get connected(): boolean {
    return this.isListening;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.sql) {
      await this.sql.end();
      this.sql = null;
    }

    this.isListening = false;
    this.handlers.clear();
    console.info("[pg-listener] Disconnected");
  }
}

// Singleton instance
// In development with hot reload, we need to persist across module reloads
const globalForPgListener = globalThis as unknown as {
  pgListener: PgListener | undefined;
};

export const pgListener = globalForPgListener.pgListener ?? new PgListener();

if (process.env.NODE_ENV !== "production") {
  globalForPgListener.pgListener = pgListener;
}

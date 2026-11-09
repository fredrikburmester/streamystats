ALTER TABLE "users" ADD CONSTRAINT "users_server_id_id_unique" UNIQUE("server_id","id");
--> statement-breakpoint
CREATE TABLE "user_merge_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"request_hash" text NOT NULL,
	"source_user_id" text NOT NULL,
	"source_name" text NOT NULL,
	"target_user_id" text NOT NULL,
	"target_name" text NOT NULL,
	"transferred" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_merge_audit_operation_unique" UNIQUE("server_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "user_merges" (
	"server_id" integer NOT NULL,
	"source_user_id" text NOT NULL,
	"source_name" text NOT NULL,
	"target_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_merges_server_id_source_user_id_pk" PRIMARY KEY("server_id","source_user_id")
);
--> statement-breakpoint
ALTER TABLE "user_merge_audit" ADD CONSTRAINT "user_merge_audit_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_merges" ADD CONSTRAINT "user_merges_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_merges" ADD CONSTRAINT "user_merges_target_fk" FOREIGN KEY ("server_id","target_user_id") REFERENCES "public"."users"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
--> statement-breakpoint
-- Shared locks fence ingestion against the exclusive lock used by a merge.
CREATE FUNCTION streamystats_retired_user_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(582, NEW.server_id);
  IF EXISTS (SELECT 1 FROM user_merges WHERE server_id = NEW.server_id AND source_user_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER retired_user_guard BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION streamystats_retired_user_guard();
--> statement-breakpoint
CREATE FUNCTION streamystats_merge_session_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(582, NEW.server_id);
  SELECT target_user_id INTO destination FROM user_merges
    WHERE server_id = NEW.server_id AND source_user_id = COALESCE(NEW.user_id, NEW.user_server_id);
  IF destination IS NOT NULL THEN
    NEW.user_id := destination;
    SELECT name INTO NEW.user_name FROM users WHERE id = destination AND server_id = NEW.server_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER merge_session_owner BEFORE INSERT OR UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_session_owner();
--> statement-breakpoint
CREATE FUNCTION streamystats_merge_record_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(582, NEW.server_id);
  SELECT target_user_id INTO destination FROM user_merges
    WHERE server_id = NEW.server_id AND source_user_id = NEW.user_id;
  IF destination IS NOT NULL THEN
    -- Old asynchronous fingerprint calculations must not overwrite the destination.
    IF TG_TABLE_NAME = 'user_fingerprints' THEN RETURN NULL; END IF;
    NEW.user_id := destination;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER merge_record_owner BEFORE INSERT OR UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_record_owner();
--> statement-breakpoint
CREATE TRIGGER merge_record_owner BEFORE INSERT OR UPDATE ON watchlists
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_record_owner();
--> statement-breakpoint
CREATE TRIGGER merge_record_owner BEFORE INSERT OR UPDATE ON hidden_recommendations
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_record_owner();
--> statement-breakpoint
CREATE TRIGGER merge_record_owner BEFORE INSERT OR UPDATE ON anomaly_events
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_record_owner();
--> statement-breakpoint
CREATE TRIGGER merge_record_owner BEFORE INSERT OR UPDATE ON user_fingerprints
FOR EACH ROW EXECUTE FUNCTION streamystats_merge_record_owner();

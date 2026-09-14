ALTER TABLE "users" ADD CONSTRAINT "users_server_id_id_unique" UNIQUE("server_id","id");
--> statement-breakpoint
CREATE TABLE "user_group_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"request_hash" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_audit_operation_unique" UNIQUE("server_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"server_id" integer NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_members_server_id_user_id_pk" PRIMARY KEY("server_id","user_id"),
	CONSTRAINT "user_group_members_group_user_unique" UNIQUE("server_id","group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"primary_user_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_groups_server_id_id_unique" UNIQUE("server_id","id")
);
--> statement-breakpoint
ALTER TABLE "user_group_audit" ADD CONSTRAINT "user_group_audit_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_fk" FOREIGN KEY ("server_id","group_id") REFERENCES "public"."user_groups"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_account_fk" FOREIGN KEY ("server_id","user_id") REFERENCES "public"."users"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_primary_account_fk" FOREIGN KEY ("server_id","primary_user_id") REFERENCES "public"."users"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--> statement-breakpoint
-- Deferred because a group and its primary membership are created atomically.
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_primary_member_fk"
FOREIGN KEY ("server_id", "id", "primary_user_id")
REFERENCES "user_group_members" ("server_id", "group_id", "user_id")
DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
-- Account and group cascades both originate at servers. Defer their checks
-- until all cascades finish; deleting a member alone still fails at commit.
ALTER TABLE "user_groups" ALTER CONSTRAINT "user_groups_primary_account_fk" DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "user_group_members" ALTER CONSTRAINT "user_group_members_account_fk" DEFERRABLE INITIALLY DEFERRED;

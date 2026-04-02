ALTER TABLE "servers" ADD COLUMN "disable_password_login" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enabled_folders" text[] DEFAULT '{}';
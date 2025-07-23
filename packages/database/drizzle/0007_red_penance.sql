ALTER TABLE "servers" ADD COLUMN "jellyseerr_url" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "jellyseerr_api_key" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "jellyseerr_username" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "enable_jellyseerr_integration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "jellyseerr_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "jellyseerr_last_sync" timestamp;
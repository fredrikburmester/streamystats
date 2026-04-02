CREATE TABLE "item_libraries" (
	"item_id" text NOT NULL,
	"library_id" text NOT NULL,
	CONSTRAINT "item_libraries_item_id_library_id_pk" PRIMARY KEY("item_id","library_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enabled_folders" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "item_libraries" ADD CONSTRAINT "item_libraries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_libraries" ADD CONSTRAINT "item_libraries_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;
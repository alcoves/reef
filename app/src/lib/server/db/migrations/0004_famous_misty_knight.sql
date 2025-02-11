DROP TABLE "asset_thumbnails" CASCADE;--> statement-breakpoint
ALTER TABLE "asset_proxies" ADD COLUMN "width" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_proxies" ADD COLUMN "height" integer DEFAULT 0 NOT NULL;
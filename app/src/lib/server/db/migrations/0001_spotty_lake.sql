ALTER TABLE "assets" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "description" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "filename" text NOT NULL;
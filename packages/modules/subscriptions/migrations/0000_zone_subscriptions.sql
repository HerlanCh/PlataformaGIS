-- Editado a mano: Drizzle Kit entrecomilla el tipo personalizado; geography(Point, 4326) va sin comillas.
CREATE TABLE "zone_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"center" geography(Point, 4326) NOT NULL,
	"radius_m" integer NOT NULL,
	"categories" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "zone_subscriptions_radius_check" CHECK ("zone_subscriptions"."radius_m" between 100 and 2000),
	CONSTRAINT "zone_subscriptions_categories_check" CHECK (cardinality("zone_subscriptions"."categories") > 0)
);
--> statement-breakpoint
CREATE INDEX "zone_subscriptions_center_idx" ON "zone_subscriptions" USING gist ("center");--> statement-breakpoint
CREATE INDEX "zone_subscriptions_user_idx" ON "zone_subscriptions" USING btree ("user_id");
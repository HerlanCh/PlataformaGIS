-- Editado a mano: Drizzle Kit genera geometry(point) sin SRID; aquí se fija WGS84 (4326).
CREATE TABLE "categories" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ttl_minutes" integer NOT NULL,
	"dedup_radius_m" integer NOT NULL,
	"is_sensitive" boolean NOT NULL,
	CONSTRAINT "categories_ttl_check" CHECK ("categories"."ttl_minutes" > 0),
	CONSTRAINT "categories_dedup_radius_check" CHECK ("categories"."dedup_radius_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_code" text NOT NULL,
	"author_id" uuid NOT NULL,
	"status" text NOT NULL,
	"ttl_minutes" integer NOT NULL,
	"extensions" integer NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"public_location" geometry(Point, 4326) NOT NULL,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "reports_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')),
	CONSTRAINT "reports_extensions_check" CHECK ("reports"."extensions" between 0 and 2),
	CONSTRAINT "reports_rejection_reason_check" CHECK ("reports"."rejection_reason" is null or "reports"."rejection_reason" in ('MODERACION', 'AUTOR_SILENCIADO'))
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_category_code_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_location_idx" ON "reports" USING gist ("location");--> statement-breakpoint
CREATE INDEX "reports_public_location_idx" ON "reports" USING gist ("public_location");--> statement-breakpoint
CREATE INDEX "reports_vigentes_idx" ON "reports" USING btree ("status","expires_at") WHERE "reports"."status" in ('ACTIVO', 'CONFIRMADO');
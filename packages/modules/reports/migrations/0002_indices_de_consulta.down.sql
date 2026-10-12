DROP INDEX "reportes_creado_en_idx";--> statement-breakpoint
DROP INDEX "reportes_ubicacion_geography_idx";--> statement-breakpoint
CREATE INDEX "reportes_ubicacion_idx" ON "reportes" USING gist ("ubicacion");

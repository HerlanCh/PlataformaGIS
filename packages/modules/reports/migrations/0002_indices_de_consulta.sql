DROP INDEX "reportes_ubicacion_idx";--> statement-breakpoint
CREATE INDEX "reportes_ubicacion_geography_idx" ON "reportes" USING gist (("ubicacion"::geography));--> statement-breakpoint
CREATE INDEX "reportes_creado_en_idx" ON "reportes" USING btree ("creado_en");
CREATE TABLE "cola_moderacion" (
	"id_reporte" uuid PRIMARY KEY NOT NULL,
	"negaciones" integer NOT NULL,
	"marcado" boolean NOT NULL,
	"motivos" text[] NOT NULL,
	"actualizado_en" timestamp with time zone NOT NULL,
	"resuelto_en" timestamp with time zone,
	CONSTRAINT "cola_moderacion_negaciones_check" CHECK ("cola_moderacion"."negaciones" >= 0)
);
--> statement-breakpoint
CREATE INDEX "cola_moderacion_pendientes_idx" ON "cola_moderacion" USING btree ("marcado" DESC NULLS LAST,"negaciones" DESC NULLS LAST,"actualizado_en") WHERE "cola_moderacion"."resuelto_en" is null;
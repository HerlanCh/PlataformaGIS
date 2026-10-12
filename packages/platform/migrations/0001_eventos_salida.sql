CREATE TABLE "eventos_salida" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"contenido" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"publicado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "eventos_salida_pendientes_idx" ON "eventos_salida" USING btree ("creado_en") WHERE "eventos_salida"."publicado_en" is null;
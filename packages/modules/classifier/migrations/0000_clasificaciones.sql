CREATE TABLE "clasificaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_reporte" uuid NOT NULL,
	"sospechoso" boolean NOT NULL,
	"motivos" text[] NOT NULL,
	"puntaje" real NOT NULL,
	"clasificador" text NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "clasificaciones_puntaje_check" CHECK ("clasificaciones"."puntaje" between 0 and 1)
);
--> statement-breakpoint
CREATE INDEX "clasificaciones_reporte_idx" ON "clasificaciones" USING btree ("id_reporte");
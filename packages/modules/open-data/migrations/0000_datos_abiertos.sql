CREATE TABLE "datos_abiertos_reportes" (
	"huella" text PRIMARY KEY NOT NULL,
	"codigo_categoria" text NOT NULL,
	"celda_latitud" double precision NOT NULL,
	"celda_longitud" double precision NOT NULL,
	"hora" timestamp with time zone NOT NULL,
	"estado_final" text NOT NULL,
	"fue_confirmado" boolean NOT NULL,
	CONSTRAINT "datos_abiertos_estado_final_check" CHECK ("datos_abiertos_reportes"."estado_final" in ('RESUELTO', 'CADUCADO', 'RECHAZADO')),
	CONSTRAINT "datos_abiertos_hora_truncada_check" CHECK (date_trunc('hour', "datos_abiertos_reportes"."hora" at time zone 'UTC') = "datos_abiertos_reportes"."hora" at time zone 'UTC'),
	CONSTRAINT "datos_abiertos_huella_check" CHECK ("datos_abiertos_reportes"."huella" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX "datos_abiertos_hora_idx" ON "datos_abiertos_reportes" USING btree ("hora");
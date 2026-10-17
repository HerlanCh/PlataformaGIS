CREATE TABLE "eventos_procesados" (
	"id_evento" uuid NOT NULL,
	"manejador" text NOT NULL,
	"procesado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_procesados_pkey" PRIMARY KEY("id_evento","manejador")
);
--> statement-breakpoint
ALTER TABLE "eventos_salida" ADD COLUMN "intentos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eventos_salida" ADD COLUMN "ultimo_error" text;--> statement-breakpoint
ALTER TABLE "eventos_salida" ADD COLUMN "proximo_intento" timestamp with time zone;
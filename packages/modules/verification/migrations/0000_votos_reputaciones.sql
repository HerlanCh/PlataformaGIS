CREATE TABLE "reputaciones" (
	"id_usuario" uuid PRIMARY KEY NOT NULL,
	"puntaje" numeric(3, 2) NOT NULL,
	"ultima_penalizacion_en" timestamp with time zone,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reputaciones_puntaje_check" CHECK ("reputaciones"."puntaje" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "votos" (
	"id_reporte" uuid NOT NULL,
	"id_usuario" uuid NOT NULL,
	"valor" text NOT NULL,
	"peso" numeric(3, 2) NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "votos_pkey" PRIMARY KEY("id_reporte","id_usuario"),
	CONSTRAINT "votos_valor_check" CHECK ("votos"."valor" in ('CONFIRMACION', 'NEGACION')),
	CONSTRAINT "votos_peso_check" CHECK ("votos"."peso" between 0 and 5)
);

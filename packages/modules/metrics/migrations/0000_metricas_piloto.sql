CREATE TABLE "metricas_actividad" (
	"dia" date NOT NULL,
	"huella" text NOT NULL,
	CONSTRAINT "metricas_actividad_dia_huella_pk" PRIMARY KEY("dia","huella"),
	CONSTRAINT "metricas_actividad_huella_check" CHECK ("metricas_actividad"."huella" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "metricas_diarias" (
	"dia" date PRIMARY KEY NOT NULL,
	"usuarios_activos" integer NOT NULL,
	CONSTRAINT "metricas_diarias_usuarios_check" CHECK ("metricas_diarias"."usuarios_activos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "metricas_reportes" (
	"id_reporte" uuid PRIMARY KEY NOT NULL,
	"codigo_categoria" text NOT NULL,
	"es_oficial" boolean NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	"primera_confirmacion_en" timestamp with time zone,
	"confirmado_en" timestamp with time zone,
	"cierre" text,
	"cerrado_en" timestamp with time zone,
	CONSTRAINT "metricas_reportes_cierre_check" CHECK ("metricas_reportes"."cierre" is null or "metricas_reportes"."cierre" in ('CADUCIDAD', 'VOTOS', 'MODERACION')),
	CONSTRAINT "metricas_reportes_cierre_completo_check" CHECK (("metricas_reportes"."cierre" is null) = ("metricas_reportes"."cerrado_en" is null))
);
--> statement-breakpoint
CREATE INDEX "metricas_reportes_creado_en_idx" ON "metricas_reportes" USING btree ("creado_en");
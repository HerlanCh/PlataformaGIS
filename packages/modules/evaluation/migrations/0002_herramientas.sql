CREATE TABLE "evaluacion_etiquetas" (
	"evaluador" text NOT NULL,
	"id_envio" uuid NOT NULL,
	"grupo" text NOT NULL,
	CONSTRAINT "evaluacion_etiquetas_evaluador_id_envio_pk" PRIMARY KEY("evaluador","id_envio"),
	CONSTRAINT "evaluacion_etiquetas_evaluador_check" CHECK ("evaluacion_etiquetas"."evaluador" in ('A', 'B', 'CONSENSO')),
	CONSTRAINT "evaluacion_etiquetas_grupo_check" CHECK (char_length("evaluacion_etiquetas"."grupo") between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "evaluacion_marcas" (
	"id_tarea" uuid NOT NULL,
	"id_punto" uuid NOT NULL,
	"ms_desde_inicio" integer NOT NULL,
	CONSTRAINT "evaluacion_marcas_id_tarea_id_punto_pk" PRIMARY KEY("id_tarea","id_punto"),
	CONSTRAINT "evaluacion_marcas_ms_check" CHECK ("evaluacion_marcas"."ms_desde_inicio" between 0 and 180000)
);
--> statement-breakpoint
CREATE TABLE "evaluacion_sesiones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"codigo_participante" text NOT NULL,
	"secuencia" integer NOT NULL,
	"creada_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_sesiones_codigo_participante_unique" UNIQUE("codigo_participante"),
	CONSTRAINT "evaluacion_sesiones_codigo_check" CHECK ("evaluacion_sesiones"."codigo_participante" ~ '^P[0-9]{2,3}$'),
	CONSTRAINT "evaluacion_sesiones_secuencia_check" CHECK ("evaluacion_sesiones"."secuencia" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "evaluacion_tareas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_sesion" uuid NOT NULL,
	"orden" integer NOT NULL,
	"vista" text NOT NULL,
	"escenario" text NOT NULL,
	"id_instantanea" uuid NOT NULL,
	"iniciada_en" timestamp with time zone,
	"terminada_en" timestamp with time zone,
	"duracion_ms" integer,
	"agotada" boolean,
	CONSTRAINT "evaluacion_tareas_sesion_orden_unique" UNIQUE("id_sesion","orden"),
	CONSTRAINT "evaluacion_tareas_orden_check" CHECK ("evaluacion_tareas"."orden" in (1, 2)),
	CONSTRAINT "evaluacion_tareas_vista_check" CHECK ("evaluacion_tareas"."vista" in ('PROCESADA', 'BASE')),
	CONSTRAINT "evaluacion_tareas_escenario_check" CHECK ("evaluacion_tareas"."escenario" in ('E1', 'E2')),
	CONSTRAINT "evaluacion_tareas_cierre_check" CHECK (("evaluacion_tareas"."terminada_en" is null) = ("evaluacion_tareas"."duracion_ms" is null)
        and ("evaluacion_tareas"."terminada_en" is null) = ("evaluacion_tareas"."agotada" is null)
        and ("evaluacion_tareas"."terminada_en" is null or "evaluacion_tareas"."iniciada_en" is not null)),
	CONSTRAINT "evaluacion_tareas_duracion_check" CHECK ("evaluacion_tareas"."duracion_ms" between 0 and 180000)
);
--> statement-breakpoint
CREATE TABLE "evaluacion_verificaciones" (
	"id_reporte" uuid PRIMARY KEY NOT NULL,
	"resultado" text NOT NULL,
	"fin_en" timestamp with time zone,
	"fuente" text NOT NULL,
	"detalle_fuente" text,
	"registrada_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_verificaciones_resultado_check" CHECK ("evaluacion_verificaciones"."resultado" in ('REAL', 'FALSO', 'NO_VERIFICABLE')),
	CONSTRAINT "evaluacion_verificaciones_fuente_check" CHECK ("evaluacion_verificaciones"."fuente" in ('CAMPO', 'SECUNDARIA')),
	CONSTRAINT "evaluacion_verificaciones_fin_check" CHECK ("evaluacion_verificaciones"."fin_en" is null or "evaluacion_verificaciones"."resultado" = 'REAL'),
	CONSTRAINT "evaluacion_verificaciones_detalle_check" CHECK ("evaluacion_verificaciones"."detalle_fuente" is null or char_length("evaluacion_verificaciones"."detalle_fuente") <= 200)
);
--> statement-breakpoint
ALTER TABLE "evaluacion_etiquetas" ADD CONSTRAINT "evaluacion_etiquetas_id_envio_evaluacion_envios_id_envio_fk" FOREIGN KEY ("id_envio") REFERENCES "public"."evaluacion_envios"("id_envio") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluacion_marcas" ADD CONSTRAINT "evaluacion_marcas_id_tarea_evaluacion_tareas_id_fk" FOREIGN KEY ("id_tarea") REFERENCES "public"."evaluacion_tareas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluacion_tareas" ADD CONSTRAINT "evaluacion_tareas_id_sesion_evaluacion_sesiones_id_fk" FOREIGN KEY ("id_sesion") REFERENCES "public"."evaluacion_sesiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluacion_tareas" ADD CONSTRAINT "evaluacion_tareas_id_instantanea_evaluacion_instantaneas_id_fk" FOREIGN KEY ("id_instantanea") REFERENCES "public"."evaluacion_instantaneas"("id") ON DELETE no action ON UPDATE no action;
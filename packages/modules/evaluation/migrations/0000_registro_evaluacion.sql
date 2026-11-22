-- Editado a mano: Drizzle Kit genera geometry(point) sin SRID; aquí se fija WGS84 (4326).
CREATE TABLE "evaluacion_envios" (
	"id_envio" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"id_reporte" uuid NOT NULL,
	"codigo_categoria" text NOT NULL,
	"ubicacion_publica" geometry(Point, 4326) NOT NULL,
	"fuente_oficial" text,
	"recibido_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_envios_tipo_check" CHECK ("evaluacion_envios"."tipo" in ('CREADO', 'DUPLICADO')),
	CONSTRAINT "evaluacion_envios_fuente_oficial_check" CHECK ("evaluacion_envios"."fuente_oficial" is null or "evaluacion_envios"."fuente_oficial" in ('TRANSITO', 'ABC', 'MI_TELEFERICO', 'OTRA'))
);
--> statement-breakpoint
CREATE TABLE "evaluacion_transiciones" (
	"id_evento" uuid PRIMARY KEY NOT NULL,
	"id_reporte" uuid NOT NULL,
	"estado" text NOT NULL,
	"caduca_en" timestamp with time zone,
	"ocurrido_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_transiciones_estado_check" CHECK ("evaluacion_transiciones"."estado" in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')),
	CONSTRAINT "evaluacion_transiciones_caducidad_check" CHECK (("evaluacion_transiciones"."caduca_en" is null) = ("evaluacion_transiciones"."estado" in ('RESUELTO', 'CADUCADO', 'RECHAZADO')))
);
--> statement-breakpoint
CREATE TABLE "evaluacion_votos" (
	"id_evento" uuid PRIMARY KEY NOT NULL,
	"id_reporte" uuid NOT NULL,
	"valor" text NOT NULL,
	"peso" double precision NOT NULL,
	"decision" text NOT NULL,
	"ocurrido_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_votos_valor_check" CHECK ("evaluacion_votos"."valor" in ('CONFIRMACION', 'NEGACION')),
	CONSTRAINT "evaluacion_votos_peso_check" CHECK ("evaluacion_votos"."peso" between 0 and 5),
	CONSTRAINT "evaluacion_votos_decision_check" CHECK ("evaluacion_votos"."decision" in ('NINGUNA', 'CONFIRMAR', 'EXTENDER', 'RESOLVER'))
);
--> statement-breakpoint
CREATE INDEX "evaluacion_envios_ubicacion_publica_idx" ON "evaluacion_envios" USING gist ("ubicacion_publica");--> statement-breakpoint
CREATE INDEX "evaluacion_envios_recibido_en_idx" ON "evaluacion_envios" USING btree ("recibido_en");--> statement-breakpoint
CREATE INDEX "evaluacion_envios_id_reporte_idx" ON "evaluacion_envios" USING btree ("id_reporte");--> statement-breakpoint
CREATE INDEX "evaluacion_transiciones_reporte_idx" ON "evaluacion_transiciones" USING btree ("id_reporte","ocurrido_en");--> statement-breakpoint
CREATE INDEX "evaluacion_votos_reporte_idx" ON "evaluacion_votos" USING btree ("id_reporte","ocurrido_en");
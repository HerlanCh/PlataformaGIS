-- Editado a mano: Drizzle Kit genera geometry(point) sin SRID; aquí se fija WGS84 (4326). Se agrega el
-- disparador que impide modificar o borrar una instantánea (ADR-007: instantáneas inmutables).
CREATE TABLE "evaluacion_instantaneas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"instante" timestamp with time zone NOT NULL,
	"latitud_min" double precision NOT NULL,
	"latitud_max" double precision NOT NULL,
	"longitud_min" double precision NOT NULL,
	"longitud_max" double precision NOT NULL,
	"creada_en" timestamp with time zone NOT NULL,
	CONSTRAINT "evaluacion_instantaneas_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "evaluacion_instantaneas_nombre_check" CHECK (char_length("evaluacion_instantaneas"."nombre") between 1 and 40),
	CONSTRAINT "evaluacion_instantaneas_caja_check" CHECK ("evaluacion_instantaneas"."latitud_min" < "evaluacion_instantaneas"."latitud_max" and "evaluacion_instantaneas"."longitud_min" < "evaluacion_instantaneas"."longitud_max")
);
--> statement-breakpoint
CREATE TABLE "evaluacion_puntos_instantanea" (
	"id_instantanea" uuid NOT NULL,
	"vista" text NOT NULL,
	"id_punto" uuid NOT NULL,
	"id_reporte" uuid NOT NULL,
	"codigo_categoria" text NOT NULL,
	"ubicacion_publica" geometry(Point, 4326) NOT NULL,
	"estado" text,
	"caduca_en" timestamp with time zone,
	"recibido_en" timestamp with time zone,
	"fuente_oficial" text,
	CONSTRAINT "evaluacion_puntos_instantanea_id_instantanea_vista_id_punto_pk" PRIMARY KEY("id_instantanea","vista","id_punto"),
	CONSTRAINT "evaluacion_puntos_vista_check" CHECK ("evaluacion_puntos_instantanea"."vista" in ('PROCESADA', 'BASE')),
	CONSTRAINT "evaluacion_puntos_campos_check" CHECK (("evaluacion_puntos_instantanea"."vista" = 'PROCESADA' and "evaluacion_puntos_instantanea"."estado" in ('ACTIVO', 'CONFIRMADO') and "evaluacion_puntos_instantanea"."caduca_en" is not null and "evaluacion_puntos_instantanea"."recibido_en" is null)
        or ("evaluacion_puntos_instantanea"."vista" = 'BASE' and "evaluacion_puntos_instantanea"."estado" is null and "evaluacion_puntos_instantanea"."caduca_en" is null and "evaluacion_puntos_instantanea"."recibido_en" is not null))
);
--> statement-breakpoint
ALTER TABLE "evaluacion_puntos_instantanea" ADD CONSTRAINT "evaluacion_puntos_instantanea_id_instantanea_evaluacion_instantaneas_id_fk" FOREIGN KEY ("id_instantanea") REFERENCES "public"."evaluacion_instantaneas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION "evaluacion_instantanea_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'Las instantáneas de la evaluación son inmutables (%)', TG_TABLE_NAME
		USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "evaluacion_instantaneas_inmutable" BEFORE UPDATE OR DELETE ON "evaluacion_instantaneas"
	FOR EACH ROW EXECUTE FUNCTION "evaluacion_instantanea_inmutable"();--> statement-breakpoint
CREATE TRIGGER "evaluacion_puntos_instantanea_inmutable" BEFORE UPDATE OR DELETE ON "evaluacion_puntos_instantanea"
	FOR EACH ROW EXECUTE FUNCTION "evaluacion_instantanea_inmutable"();

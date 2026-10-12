-- Editado a mano: Drizzle Kit genera geometry(point) sin SRID; aquí se fija WGS84 (4326).
CREATE TABLE "categorias" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"ttl_minutos" integer NOT NULL,
	"radio_duplicado_m" integer NOT NULL,
	"es_sensible" boolean NOT NULL,
	CONSTRAINT "categorias_ttl_check" CHECK ("categorias"."ttl_minutos" > 0),
	CONSTRAINT "categorias_radio_duplicado_check" CHECK ("categorias"."radio_duplicado_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "reportes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"codigo_categoria" text NOT NULL,
	"id_autor" uuid NOT NULL,
	"estado" text NOT NULL,
	"ttl_minutos" integer NOT NULL,
	"extensiones" integer NOT NULL,
	"motivo_rechazo" text,
	"creado_en" timestamp with time zone NOT NULL,
	"caduca_en" timestamp with time zone NOT NULL,
	"ubicacion" geometry(Point, 4326) NOT NULL,
	"ubicacion_publica" geometry(Point, 4326) NOT NULL,
	"clave_idempotencia" text NOT NULL,
	CONSTRAINT "reportes_clave_idempotencia_unique" UNIQUE("clave_idempotencia"),
	CONSTRAINT "reportes_estado_check" CHECK ("reportes"."estado" in ('ACTIVO', 'CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO')),
	CONSTRAINT "reportes_extensiones_check" CHECK ("reportes"."extensiones" between 0 and 2),
	CONSTRAINT "reportes_motivo_rechazo_check" CHECK ("reportes"."motivo_rechazo" is null or "reportes"."motivo_rechazo" in ('MODERACION', 'AUTOR_SILENCIADO'))
);
--> statement-breakpoint
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_codigo_categoria_categorias_codigo_fk" FOREIGN KEY ("codigo_categoria") REFERENCES "public"."categorias"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reportes_ubicacion_idx" ON "reportes" USING gist ("ubicacion");--> statement-breakpoint
CREATE INDEX "reportes_ubicacion_publica_idx" ON "reportes" USING gist ("ubicacion_publica");--> statement-breakpoint
CREATE INDEX "reportes_vigentes_idx" ON "reportes" USING btree ("estado","caduca_en") WHERE "reportes"."estado" in ('ACTIVO', 'CONFIRMADO');
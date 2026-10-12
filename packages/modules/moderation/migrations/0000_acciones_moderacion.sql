CREATE TABLE "acciones_moderacion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_reporte" uuid NOT NULL,
	"id_moderador" uuid NOT NULL,
	"accion" text NOT NULL,
	"motivo" text,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "acciones_moderacion_accion_check" CHECK ("acciones_moderacion"."accion" in ('RECHAZAR', 'MANTENER')),
	CONSTRAINT "acciones_moderacion_motivo_check" CHECK ("acciones_moderacion"."accion" <> 'RECHAZAR' or coalesce(length(trim("acciones_moderacion"."motivo")), 0) > 0)
);
--> statement-breakpoint
CREATE INDEX "acciones_moderacion_reporte_idx" ON "acciones_moderacion" USING btree ("id_reporte");
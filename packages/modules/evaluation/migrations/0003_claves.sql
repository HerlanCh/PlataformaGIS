CREATE TABLE "evaluacion_claves" (
	"id_instantanea" uuid NOT NULL,
	"grupo" text NOT NULL,
	CONSTRAINT "evaluacion_claves_id_instantanea_grupo_pk" PRIMARY KEY("id_instantanea","grupo"),
	CONSTRAINT "evaluacion_claves_grupo_check" CHECK (char_length("evaluacion_claves"."grupo") between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "evaluacion_claves" ADD CONSTRAINT "evaluacion_claves_id_instantanea_evaluacion_instantaneas_id_fk" FOREIGN KEY ("id_instantanea") REFERENCES "public"."evaluacion_instantaneas"("id") ON DELETE no action ON UPDATE no action;
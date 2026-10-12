-- Editado a mano: Drizzle Kit entrecomilla el tipo personalizado; geography(Point, 4326) va sin comillas.
CREATE TABLE "zonas_suscritas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_usuario" uuid NOT NULL,
	"centro" geography(Point, 4326) NOT NULL,
	"radio_m" integer NOT NULL,
	"categorias" text[] NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "zonas_suscritas_radio_check" CHECK ("zonas_suscritas"."radio_m" between 100 and 2000),
	CONSTRAINT "zonas_suscritas_categorias_check" CHECK (cardinality("zonas_suscritas"."categorias") > 0)
);
--> statement-breakpoint
CREATE INDEX "zonas_suscritas_centro_idx" ON "zonas_suscritas" USING gist ("centro");--> statement-breakpoint
CREATE INDEX "zonas_suscritas_usuario_idx" ON "zonas_suscritas" USING btree ("id_usuario");
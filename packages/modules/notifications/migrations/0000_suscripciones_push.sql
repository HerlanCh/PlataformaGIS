CREATE TABLE "suscripciones_push" (
	"id" uuid PRIMARY KEY NOT NULL,
	"id_usuario" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "suscripciones_push_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE INDEX "suscripciones_push_usuario_idx" ON "suscripciones_push" USING btree ("id_usuario");
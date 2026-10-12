CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hash_dispositivo" text NOT NULL,
	"id_telegram" text,
	"rol" text NOT NULL,
	"creado_en" timestamp with time zone NOT NULL,
	CONSTRAINT "usuarios_hash_dispositivo_unique" UNIQUE("hash_dispositivo"),
	CONSTRAINT "usuarios_id_telegram_unique" UNIQUE("id_telegram"),
	CONSTRAINT "usuarios_rol_check" CHECK ("usuarios"."rol" in ('CIUDADANO', 'MODERADOR'))
);

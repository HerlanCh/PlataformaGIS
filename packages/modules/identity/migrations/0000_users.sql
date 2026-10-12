CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"device_hash" text NOT NULL,
	"telegram_id" text,
	"role" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_device_hash_unique" UNIQUE("device_hash"),
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('CIUDADANO', 'MODERADOR'))
);

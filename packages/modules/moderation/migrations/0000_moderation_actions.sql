CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"moderator_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "moderation_actions_action_check" CHECK ("moderation_actions"."action" in ('RECHAZAR', 'MANTENER')),
	CONSTRAINT "moderation_actions_reason_check" CHECK ("moderation_actions"."action" <> 'RECHAZAR' or coalesce(length(trim("moderation_actions"."reason")), 0) > 0)
);
--> statement-breakpoint
CREATE INDEX "moderation_actions_report_idx" ON "moderation_actions" USING btree ("report_id");
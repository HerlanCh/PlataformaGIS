CREATE TABLE "reputations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"score" numeric(3, 2) NOT NULL,
	"last_penalty_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reputations_score_check" CHECK ("reputations"."score" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"report_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" text NOT NULL,
	"weight" numeric(3, 2) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "votes_pkey" PRIMARY KEY("report_id","user_id"),
	CONSTRAINT "votes_value_check" CHECK ("votes"."value" in ('CONFIRMACION', 'NEGACION')),
	CONSTRAINT "votes_weight_check" CHECK ("votes"."weight" between 0 and 5)
);

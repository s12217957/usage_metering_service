CREATE TABLE "account_monthly_usage" (
	"account_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"consumed_units" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "account_monthly_usage_account_id_period_start_pk" PRIMARY KEY("account_id","period_start")
);
--> statement-breakpoint
CREATE TABLE "consumption_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" varchar(200) NOT NULL,
	"units" integer NOT NULL,
	"decision" varchar(20) NOT NULL,
	"rejection_level" varchar(20),
	"rejection_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumption_requests_account_request_id_unique" UNIQUE("account_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "user_monthly_usage" (
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"consumed_units" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_monthly_usage_user_id_period_start_pk" PRIMARY KEY("user_id","period_start")
);
--> statement-breakpoint
ALTER TABLE "account_monthly_usage" ADD CONSTRAINT "account_monthly_usage_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_requests" ADD CONSTRAINT "consumption_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_requests" ADD CONSTRAINT "consumption_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "laundromats" ALTER COLUMN "latitude" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "laundromats" ALTER COLUMN "longitude" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "laundromats" ALTER COLUMN "phone" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "laundromats" ALTER COLUMN "email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "laundromats" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" text;
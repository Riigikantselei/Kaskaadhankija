ALTER TABLE `trainings` ADD `act_partner_at` integer;--> statement-breakpoint
ALTER TABLE `trainings` ADD `act_partner_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainings` ADD `act_buyer_at` integer;--> statement-breakpoint
ALTER TABLE `trainings` ADD `act_buyer_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainings` ADD `act_rejected_at` integer;--> statement-breakpoint
ALTER TABLE `trainings` ADD `act_reject_reason` text DEFAULT '' NOT NULL;
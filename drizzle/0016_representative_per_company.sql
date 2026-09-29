-- One address, several companies [L-08] [L-18].
--
-- A partner's tester runs two companies from one mailbox and could represent
-- only one of them: an address was unique among all active representatives.
-- It is now unique within a company; the sign-in asks which company to act for
-- and the partner area can switch between them without a new code.
DROP INDEX `partner_representatives_email_active_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `partner_representatives_partner_email_active_unique` ON `partner_representatives` (`partner_id`,`email`) WHERE is_active = 1;--> statement-breakpoint
CREATE INDEX `partner_representatives_email_idx` ON `partner_representatives` (`email`);
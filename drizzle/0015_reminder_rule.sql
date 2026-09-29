-- A 24-hour answering window, and a reminder the buyer places [V-03] [D-05].
--
-- The answering window in practice is one working day, not three. With the old
-- fixed "24 hours before" reminder and the two-hour final summary [D-11], a
-- one-day round mailed partners three times at once. A round now sends three
-- mails in all — the offer, one reminder, the result — and the reminder's time
-- is the buyer's: whole hours before the deadline, or a time of day, as a lot
-- default a round can override. The round stores the instant it computed.
--
-- Existing lots move to one working day. Rounds still open get their reminder
-- from the new lot default, unless one was already sent.
ALTER TABLE `lots` ADD `reminder_mode` text DEFAULT 'hours_before' NOT NULL;--> statement-breakpoint
ALTER TABLE `lots` ADD `reminder_hours_before` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `lots` ADD `reminder_local_time` text DEFAULT '10:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `reminder_at` integer;--> statement-breakpoint
ALTER TABLE `rounds` ADD `reminder_mode` text;--> statement-breakpoint
ALTER TABLE `rounds` ADD `reminder_hours_before` integer;--> statement-breakpoint
ALTER TABLE `rounds` ADD `reminder_local_time` text;--> statement-breakpoint
UPDATE `lots` SET `response_deadline_working_days` = 1;--> statement-breakpoint
UPDATE `rounds` SET
  `reminder_mode` = 'hours_before',
  `reminder_hours_before` = 4,
  `reminder_at` = `deadline_at` - 4 * 3600000
WHERE `status` = 'open' AND `deadline_at` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `round_participants` rp
    WHERE rp.`round_id` = `rounds`.`id` AND rp.`reminder_sent_at` IS NOT NULL
  );

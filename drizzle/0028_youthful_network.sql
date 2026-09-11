CREATE TABLE `praise_contest_payments` (
	`contest_id` text NOT NULL,
	`entry_id` integer NOT NULL,
	`rank` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`reference` text,
	`note` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_payment_entry` ON `praise_contest_payments` (`contest_id`,`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_payment_rank` ON `praise_contest_payments` (`contest_id`,`rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_payment_reference` ON `praise_contest_payments` (`reference`);
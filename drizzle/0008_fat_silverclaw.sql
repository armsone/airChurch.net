CREATE TABLE IF NOT EXISTS `reviewer_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `reviewer_accounts_username_unique` ON `reviewer_accounts` (`username`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviewer_accounts_status_created` ON `reviewer_accounts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reviewer_church_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reviewer_id` integer NOT NULL,
	`church_id` integer NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`note` text,
	`reviewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`handled_at` text,
	`admin_resolution` text,
	`admin_note` text,
	`resolved_by` text,
	UNIQUE(`reviewer_id`,`church_id`)
);--> statement-breakpoint
DROP TABLE IF EXISTS `__new_reviewer_church_reviews`;--> statement-breakpoint
CREATE TABLE `__new_reviewer_church_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reviewer_id` integer NOT NULL,
	`church_id` integer NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`note` text,
	`reviewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`handled_at` text,
	`admin_resolution` text,
	`admin_note` text,
	`resolved_by` text,
	UNIQUE(`reviewer_id`,`church_id`)
);--> statement-breakpoint
INSERT INTO `__new_reviewer_church_reviews` (`id`,`reviewer_id`,`church_id`,`status`,`note`,`reviewed_at`,`handled_at`)
SELECT `id`,`reviewer_id`,`church_id`,`status`,`note`,`reviewed_at`,`handled_at` FROM `reviewer_church_reviews`;--> statement-breakpoint
DROP TABLE `reviewer_church_reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviewer_church_reviews` RENAME TO `reviewer_church_reviews`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviewer_church_reviews_church` ON `reviewer_church_reviews` (`church_id`,`reviewed_at`);--> statement-breakpoint
ALTER TABLE `churches` ADD `review_resolution_token` text;

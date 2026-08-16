CREATE TABLE `church_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_name` text NOT NULL,
	`pastor` text NOT NULL,
	`region` text NOT NULL,
	`denomination` text NOT NULL,
	`youtube_url` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_church_recommendations_status_created` ON `church_recommendations` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `churches` ADD `reviewer_status` text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `churches` ADD `reviewer_note` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `reviewed_at` text;
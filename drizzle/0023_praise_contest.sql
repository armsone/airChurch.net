CREATE TABLE `praise_contest_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `praise_contest_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contest_id` text NOT NULL,
	`youtube_id` text NOT NULL,
	`performer` text NOT NULL,
	`title` text NOT NULL,
	`channel_name` text NOT NULL,
	`contact` text NOT NULL,
	`source_file_url` text,
	`browser_hash` text NOT NULL,
	`consent_version` text NOT NULL,
	`consent_at` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`reupload_status` text DEFAULT 'awaiting_source' NOT NULL,
	`reupload_url` text,
	`admin_note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_unique_video` ON `praise_contest_entries` (`contest_id`,`youtube_id`);--> statement-breakpoint
CREATE INDEX `idx_contest_entries_order` ON `praise_contest_entries` (`contest_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `praise_contest_results` (
	`contest_id` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`finalized_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `praise_contest_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contest_id` text NOT NULL,
	`entry_id` integer NOT NULL,
	`browser_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `praise_contest_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_browser_vote` ON `praise_contest_votes` (`contest_id`,`browser_hash`);--> statement-breakpoint
CREATE INDEX `idx_contest_entry_votes` ON `praise_contest_votes` (`contest_id`,`entry_id`);
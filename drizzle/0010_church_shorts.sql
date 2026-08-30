CREATE TABLE `church_shorts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`youtube_id` text NOT NULL,
	`title` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`published_at` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_shorts_youtube_id_unique` ON `church_shorts` (`youtube_id`);--> statement-breakpoint
CREATE INDEX `idx_church_shorts_status_published` ON `church_shorts` (`status`,`published_at`);

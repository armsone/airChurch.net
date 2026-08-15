CREATE TABLE `praise_videos` (
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
CREATE UNIQUE INDEX `praise_videos_youtube_id_unique` ON `praise_videos` (`youtube_id`);--> statement-breakpoint
CREATE INDEX `idx_praise_videos_status_published` ON `praise_videos` (`status`,`published_at`);
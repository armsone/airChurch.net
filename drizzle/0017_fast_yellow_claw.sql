CREATE TABLE `ministry_appearances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`minister_name` text NOT NULL,
	`role_title` text NOT NULL,
	`host_church_name` text NOT NULL,
	`event_title` text NOT NULL,
	`source_url` text NOT NULL,
	`video_id` text,
	`occurred_at` text NOT NULL,
	`source_checked_at` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ministry_appearances_person_review` ON `ministry_appearances` (`church_id`,`minister_name`,`review_status`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ministry_appearances_source` ON `ministry_appearances` (`source_url`);
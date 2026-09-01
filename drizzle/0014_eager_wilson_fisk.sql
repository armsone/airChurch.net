CREATE TABLE `church_profiles` (
	`church_id` integer PRIMARY KEY NOT NULL,
	`slogan` text,
	`vision` text,
	`summary` text,
	`address` text,
	`source_url` text NOT NULL,
	`source_text` text NOT NULL,
	`collected_at` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_church_profiles_review_church` ON `church_profiles` (`review_status`,`church_id`);--> statement-breakpoint
CREATE TABLE `worship_schedules` (
	`record_id` text PRIMARY KEY NOT NULL,
	`church_id` integer NOT NULL,
	`service_type` text NOT NULL,
	`day_of_week` text NOT NULL,
	`start_time` text NOT NULL,
	`venue_audience` text,
	`source_text` text NOT NULL,
	`source_url` text NOT NULL,
	`collected_at` text NOT NULL,
	`confidence` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_worship_schedules_church_review` ON `worship_schedules` (`church_id`,`review_status`,`day_of_week`,`start_time`);
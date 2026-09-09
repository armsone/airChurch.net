CREATE TABLE `event_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`event_id` text,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`evidence` text NOT NULL,
	`content_hash` text NOT NULL,
	`payload` text,
	`status` text NOT NULL,
	`reason` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`checked_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `event_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_candidates_source` ON `event_candidates` (`source_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_event_candidates_event` ON `event_candidates` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`homepage` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`last_checked_at` text,
	`last_success_at` text,
	`next_check_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL,
	`lease_token` text,
	`lease_until` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_event_sources_due` ON `event_sources` (`enabled`,`next_check_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`church_id` integer,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text,
	`venue` text NOT NULL,
	`region` text NOT NULL,
	`attendance` text NOT NULL,
	`organizer` text NOT NULL,
	`audience` text NOT NULL,
	`category` text NOT NULL,
	`source_url` text NOT NULL,
	`registration_url` text,
	`status` text DEFAULT 'published' NOT NULL,
	`checked_at` text NOT NULL,
	`valid_until` text NOT NULL,
	`content_hash` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `event_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_dates` ON `events` (`status`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `idx_events_church_dates` ON `events` (`church_id`,`status`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_events_source` ON `events` (`source_id`,`status`);
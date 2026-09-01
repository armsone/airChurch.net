CREATE TABLE `church_ministry_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`name` text NOT NULL,
	`role_title` text NOT NULL,
	`role_category` text NOT NULL,
	`role_status` text DEFAULT 'current' NOT NULL,
	`source_url` text NOT NULL,
	`source_checked_at` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ministry_profiles_church_review` ON `church_ministry_profiles` (`church_id`,`review_status`,`role_category`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ministry_profiles_identity` ON `church_ministry_profiles` (`church_id`,`name`,`role_title`,`role_status`);--> statement-breakpoint
CREATE TABLE `ministry_profile_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`name` text NOT NULL,
	`role_title` text NOT NULL,
	`source_url` text,
	`note` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ministry_suggestions_status_created` ON `ministry_profile_suggestions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ministry_suggestions_church_created` ON `ministry_profile_suggestions` (`church_id`,`created_at`);--> statement-breakpoint
DROP INDEX `idx_encouragement_target_status_created`;--> statement-breakpoint
ALTER TABLE `encouragement_messages` ADD `target_ref` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_encouragement_target_status_created` ON `encouragement_messages` (`church_id`,`target_type`,`target_ref`,`status`,`created_at`);
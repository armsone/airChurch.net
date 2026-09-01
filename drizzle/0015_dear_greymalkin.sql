CREATE TABLE `encouragement_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`nickname` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`moderated_at` text,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_encouragement_target_status_created` ON `encouragement_messages` (`church_id`,`target_type`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_encouragement_status_created` ON `encouragement_messages` (`status`,`created_at`);
CREATE TABLE IF NOT EXISTS `church_change_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reviewer_id` integer NOT NULL,
	`church_id` integer NOT NULL,
	`request_type` text NOT NULL,
	`reason` text NOT NULL,
	`proposed_name` text,
	`proposed_pastor` text,
	`proposed_region` text,
	`proposed_denomination` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_church_change_requests_status_created` ON `church_change_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_church_change_requests_reviewer_created` ON `church_change_requests` (`reviewer_id`,`created_at`);

CREATE TABLE `private_church_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`contact_type` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`value_digest` text NOT NULL,
	`scope` text DEFAULT 'organization' NOT NULL,
	`source_url` text NOT NULL,
	`review_status` text DEFAULT 'approved' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_private_church_contacts_church` ON `private_church_contacts` (`church_id`,`review_status`,`contact_type`);--> statement-breakpoint
CREATE TABLE `private_contact_access_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_role` text NOT NULL,
	`actor_id` integer DEFAULT 0 NOT NULL,
	`record_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_private_contact_access_created` ON `private_contact_access_events` (`created_at`);
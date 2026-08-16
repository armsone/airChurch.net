CREATE TABLE `visitor_activity` (
	`visitor_hash` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`last_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visitor_activity_last_seen` ON `visitor_activity` (`last_seen`);
ALTER TABLE `event_sources` ADD `collector_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `event_sources` ADD `scan_url` text;
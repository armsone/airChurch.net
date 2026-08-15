ALTER TABLE `sermons` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_sermons_status_published` ON `sermons` (`status`,`published_at`);

ALTER TABLE `reviewer_accounts` ADD `church_id` integer REFERENCES churches(id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviewer_accounts_church` ON `reviewer_accounts` (`church_id`,`status`);

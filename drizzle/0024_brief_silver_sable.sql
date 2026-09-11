DROP INDEX `idx_contest_browser_vote`;--> statement-breakpoint
ALTER TABLE `praise_contest_votes` ADD `vote_day` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE praise_contest_votes SET vote_day=date(created_at,'+9 hours');--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contest_browser_vote` ON `praise_contest_votes` (`contest_id`,`browser_hash`,`vote_day`);
CREATE INDEX `idx_churches_search` ON `churches` (`region`,`name`,`pastor`);--> statement-breakpoint
CREATE INDEX `idx_community_posts_status_created` ON `community_posts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sermons_published_at` ON `sermons` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_talent_offers_status_created` ON `talent_offers` (`status`,`created_at`);
CREATE TABLE `making_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_slug` text NOT NULL,
	`nickname` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_making_comments_post_status` ON `making_comments` (`post_slug`,`status`,`id`);--> statement-breakpoint
CREATE INDEX `idx_making_comments_status` ON `making_comments` (`status`,`id`);--> statement-breakpoint
CREATE TABLE `making_posts` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`body` text NOT NULL,
	`sources` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE `churches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pastor` text NOT NULL,
	`region` text NOT NULL,
	`denomination` text NOT NULL,
	`youtube_channel_id` text,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `churches_youtube_channel_id_unique` ON `churches` (`youtube_channel_id`);--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`nickname` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sermons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`youtube_id` text NOT NULL,
	`title` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`published_at` text NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sermons_youtube_id_unique` ON `sermons` (`youtube_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`last_synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `talent_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`region` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

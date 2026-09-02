CREATE TABLE `church_news_snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`item_count` integer NOT NULL,
	`refreshed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

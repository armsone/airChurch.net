CREATE TABLE `praise_contest_decisions` (
	`contest_id` text PRIMARY KEY NOT NULL,
	`eligible_count` integer NOT NULL,
	`cancelled` integer NOT NULL,
	`decided_at` text NOT NULL
);

CREATE TABLE `praise_contest_vote_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contest_id` text NOT NULL,
	`entry_id` integer NOT NULL,
	`browser_hash` text NOT NULL,
	`vote_day` text NOT NULL,
	`delta` integer NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contest_vote_events` ON `praise_contest_vote_events` (`contest_id`,`entry_id`);
--> statement-breakpoint
INSERT INTO praise_contest_vote_events(contest_id,entry_id,browser_hash,vote_day,delta,occurred_at) SELECT contest_id,entry_id,browser_hash,vote_day,1,created_at FROM praise_contest_votes;
--> statement-breakpoint
CREATE TRIGGER praise_vote_added AFTER INSERT ON praise_contest_votes BEGIN
 INSERT INTO praise_contest_vote_events(contest_id,entry_id,browser_hash,vote_day,delta,occurred_at) VALUES (NEW.contest_id,NEW.entry_id,NEW.browser_hash,NEW.vote_day,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER praise_vote_removed AFTER DELETE ON praise_contest_votes BEGIN
 INSERT INTO praise_contest_vote_events(contest_id,entry_id,browser_hash,vote_day,delta,occurred_at) VALUES (OLD.contest_id,OLD.entry_id,OLD.browser_hash,OLD.vote_day,-1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

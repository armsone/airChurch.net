ALTER TABLE `churches` ADD `hold_reason` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `hold_note` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `held_at` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `priority_weight` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `churches` SET `hold_reason`='youtube_unavailable',`hold_note`='공식 YouTube 채널 또는 최근 180일 내 검증 가능한 설교·예배 업로드를 확인하지 못해 보류했습니다.',`held_at`=CURRENT_TIMESTAMP WHERE `review_status`='removed' AND `hold_note` IS NULL;

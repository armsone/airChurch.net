-- 교회 내부 기본 키는 그대로 유지하고, 외부 URL에 쓰는 공개 번호를 별도로 만든다.
-- 거룩한빛광성교회는 1번, 2~10000은 향후 수동 지정용 예약 구간이다.
ALTER TABLE `churches` ADD `public_id` integer;
--> statement-breakpoint
UPDATE churches
SET public_id=1
WHERE id=(
  SELECT id
  FROM churches
  WHERE name='거룩한빛광성교회'
  ORDER BY id
  LIMIT 1
);
--> statement-breakpoint
WITH unassigned AS (
  SELECT id,ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM churches
  WHERE public_id IS NULL
)
UPDATE churches
SET public_id=10000+(
  SELECT unassigned.rn
  FROM unassigned
  WHERE unassigned.id=churches.id
)
WHERE id IN (SELECT id FROM unassigned);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_churches_public_id` ON `churches` (`public_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_churches_public_id`
AFTER INSERT ON `churches`
WHEN NEW.public_id IS NULL
BEGIN
  UPDATE churches
  SET public_id=(
    SELECT MAX(COALESCE(MAX(public_id),0),10000)+1
    FROM churches
    WHERE id<>NEW.id
      AND public_id IS NOT NULL
      AND public_id<1000000
  )
  WHERE id=NEW.id;
END;

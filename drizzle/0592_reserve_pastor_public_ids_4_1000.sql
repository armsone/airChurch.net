-- 공개 목회자 번호 4~1000을 향후 수동 지정용으로 예약한다.
-- 의도적으로 배정된 0(정성진)·1(곽승현)·2(김민석)·3(이일현)은 그대로 둔다.
-- 4~1000 구간에 있는 기존 번호는 현재 사용 중인 최대 번호(레거시 1000000대 제외) 다음부터
-- 기존 번호 오름차순 그대로 옮긴다. 최대 번호가 1000 이하이면 1001부터 시작해 예약 구간을 비운다.
-- 새 번호는 모두 기존 최대 번호보다 크고 서로 다르므로 idx_pastor_people_public_id 유니크 인덱스와 충돌하지 않는다.
WITH movable AS (
  SELECT id,ROW_NUMBER() OVER (ORDER BY public_id) AS rn
  FROM pastor_people
  WHERE public_id BETWEEN 4 AND 1000
), base AS (
  SELECT CASE WHEN COALESCE(MAX(public_id),3)<1000 THEN 1000 ELSE MAX(public_id) END AS max_id
  FROM pastor_people
  WHERE public_id IS NOT NULL AND public_id<1000000
)
UPDATE pastor_people
SET public_id=(SELECT base.max_id+movable.rn FROM movable,base WHERE movable.id=pastor_people.id),
    updated_at=CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM movable);

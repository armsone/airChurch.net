-- 공개 목회자 번호 예약 구간을 4~1000에서 4~10000으로 확장한다.
-- 0592가 이미 처리한 4~1000 구간은 그대로 두고, 1001~10000 구간에 있는 기존 번호만
-- 현재 사용 중인 최대 번호(레거시 1000000대 제외) 다음부터 기존 번호 오름차순 그대로 옮긴다.
-- 최대 번호가 10000 미만이면 10000부터 시작해 예약 구간 전체를 비운다.
-- 새 번호는 모두 기존 최대 번호보다 크고 서로 다르므로 idx_pastor_people_public_id 유니크 인덱스와 충돌하지 않는다.
WITH movable AS (
  SELECT id,ROW_NUMBER() OVER (ORDER BY public_id) AS rn
  FROM pastor_people
  WHERE public_id BETWEEN 1001 AND 10000
), base AS (
  SELECT CASE WHEN COALESCE(MAX(public_id),3)<10000 THEN 10000 ELSE MAX(public_id) END AS max_id
  FROM pastor_people
  WHERE public_id IS NOT NULL AND public_id<1000000
)
UPDATE pastor_people
SET public_id=(SELECT base.max_id+movable.rn FROM movable,base WHERE movable.id=pastor_people.id),
    updated_at=CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM movable);

-- 동일교회가 공식 공개한 교회/부서 목회자 연혁은 현임 명단이 아니라 역대 사역 기록이다.
-- 같은 역대 관계가 이미 있으면 잘못 생성된 현임 중복 관계만 제거한다.
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status = 'current'
  AND current_role.source_url IN (
    'https://www.dongilch.com/Page/Index/25',
    'https://www.dongilch.com/Page/Index/102156'
  )
  AND EXISTS (
    SELECT 1
    FROM pastor_church_roles AS former_role
    WHERE former_role.pastor_id = current_role.pastor_id
      AND COALESCE(former_role.church_id, -1) = COALESCE(current_role.church_id, -1)
      AND former_role.church_name = current_role.church_name
      AND former_role.role_title = current_role.role_title
      AND former_role.role_status = 'former'
  );

UPDATE pastor_church_roles
SET role_status = 'former', updated_at = CURRENT_TIMESTAMP
WHERE role_status = 'current'
  AND source_url IN (
    'https://www.dongilch.com/Page/Index/25',
    'https://www.dongilch.com/Page/Index/102156'
  );

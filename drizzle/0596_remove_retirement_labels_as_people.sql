-- Remove ten verified non-person records from public use, as requested.
-- Preserve underlying records and related messages/contact data.
UPDATE pastor_people SET review_status='removed',updated_at=CURRENT_TIMESTAMP
WHERE (public_id IN (16992,16989,15889) AND name='은퇴')
   OR (public_id IN (17012,14764) AND name='은퇴예식')
   OR (public_id IN (14423,15840) AND name='은퇴장로')
   OR (public_id=16874 AND name='전국')
   OR (public_id=15792 AND name='전북')
   OR (public_id=16582 AND name='여수');

UPDATE church_ministry_profiles SET review_status='removed',updated_at=CURRENT_TIMESTAMP
WHERE name IN ('은퇴','은퇴예식','은퇴장로');

-- Only the matching church and retired-clergy label in the legacy directory.
UPDATE church_ministry_profiles SET review_status='removed',updated_at=CURRENT_TIMESTAMP
WHERE role_title='은퇴목사' AND (
  (name='전국' AND church_id IN (SELECT id FROM churches WHERE name='성광교회'))
  OR (name='전북' AND church_id IN (SELECT id FROM churches WHERE name='드림교회'))
  OR (name='여수' AND church_id IN (SELECT id FROM churches WHERE name='영광교회'))
);

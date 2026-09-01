-- Join complementary founding and retired roles only when the same church's official sources identify the same person.
UPDATE pastor_people
SET photo_url=COALESCE(photo_url,(SELECT photo_url FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73')),
    photo_source_url=COALESCE(photo_source_url,(SELECT photo_source_url FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73')),
    photo_sha256=COALESCE(photo_sha256,(SELECT photo_sha256 FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73')),
    photo_usage_basis=COALESCE(photo_usage_basis,(SELECT photo_usage_basis FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73')),
    photo_review_status=CASE WHEN photo_url IS NOT NULL THEN photo_review_status ELSE COALESCE((SELECT photo_review_status FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73'),'pending') END,
    updated_at=CURRENT_TIMESTAMP
WHERE directory_id='person-b16564f403989379082b';

DELETE FROM pastor_church_roles
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73')
  AND EXISTS (
    SELECT 1 FROM pastor_church_roles canonical
    WHERE canonical.pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-b16564f403989379082b')
      AND COALESCE(canonical.church_id,-1)=COALESCE(pastor_church_roles.church_id,-1)
      AND COALESCE(canonical.church_name,'')=COALESCE(pastor_church_roles.church_name,'')
      AND canonical.role_title=pastor_church_roles.role_title
      AND canonical.role_status=pastor_church_roles.role_status
  );

UPDATE pastor_church_roles
SET pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-b16564f403989379082b'),updated_at=CURRENT_TIMESTAMP
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73');

UPDATE pastor_encouragement_messages
SET pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-b16564f403989379082b')
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73');

UPDATE pastor_private_contact_values
SET pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-b16564f403989379082b'),updated_at=CURRENT_TIMESTAMP
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-fd75443eed36683a8b73');

UPDATE pastor_people SET review_status='removed',updated_at=CURRENT_TIMESTAMP WHERE directory_id='person-fd75443eed36683a8b73';

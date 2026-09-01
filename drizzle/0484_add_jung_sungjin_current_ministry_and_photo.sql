-- Official current ministry, long-term pastoral history summary, and official single-person profile photo.
UPDATE pastor_people
SET public_summary='거룩한빛광성교회를 개척해 오랫동안 목회한 뒤 은퇴했으며, 현재 사단법인 크로스로드 대표로 사역하고 있습니다.',
    photo_url='https://data.dimode.co.kr/UserData/kwangsung/files/13/424/7KCV7ISx7KeEXeydgO2HtOuqqeyCrC5wbmdkaW1vZGVfOTc0ODc2OF9lbmMc.png',
    photo_source_url='https://kwangsung.org/Page/Index/13',
    photo_sha256='dfd980b7e5fba374b506239dea09cf6a27d4441b5f1edc6458ee42f082dd44b1',
    photo_usage_basis='official_public_clergy_profile',
    photo_review_status='approved',
    updated_at=CURRENT_TIMESTAMP
WHERE directory_id='person-b16564f403989379082b';

INSERT OR IGNORE INTO pastor_church_roles
  (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status)
SELECT id,NULL,'사단법인 크로스로드',NULL,'경기 고양','대표','other','current',NULL,NULL,'https://www.crossroad.or.kr/','approved'
FROM pastor_people WHERE directory_id='person-b16564f403989379082b';

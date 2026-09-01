INSERT INTO pastor_people
  (directory_id,name,public_summary,photo_url,photo_source_url,photo_sha256,photo_usage_basis,photo_review_status,review_status)
VALUES
  ('person-34da9588f36a90d3d120','이일현','거룩한빛광성교회에서 6교구와 통일선교·자치회 사역을 맡고 있습니다.','https://data.dimode.co.kr/UserData/kwangsung/files/15/177162/7J207J287ZiELnBuZ2RpbW9kZV84NDg3MDgyX2VuYwcc.png','https://kwangsung.org/Page/Index/15','c772e8b0ed507b6b8c64d82a78b1dac44cbf4a3826728d69ca0cdd9054ee4d1b','official_public_clergy_profile','approved','approved')
ON CONFLICT(directory_id) DO UPDATE SET
  name=excluded.name,
  public_summary=excluded.public_summary,
  photo_url=excluded.photo_url,
  photo_source_url=excluded.photo_source_url,
  photo_sha256=excluded.photo_sha256,
  photo_usage_basis=excluded.photo_usage_basis,
  photo_review_status=excluded.photo_review_status,
  review_status='approved',
  updated_at=CURRENT_TIMESTAMP;

INSERT OR IGNORE INTO pastor_church_roles
  (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status)
SELECT id,3,'거룩한빛광성교회','대한예수교장로회 통합','경기 고양','부목사','associate','current',NULL,NULL,'https://kwangsung.org/Page/Index/15','approved'
FROM pastor_people WHERE directory_id='person-34da9588f36a90d3d120';

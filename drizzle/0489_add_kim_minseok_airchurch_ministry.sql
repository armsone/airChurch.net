INSERT OR IGNORE INTO pastor_church_roles
  (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status)
SELECT id,NULL,'airChurch',NULL,NULL,'협동목사','cooperating','current',NULL,NULL,'https://airchurch.net/about','approved'
FROM pastor_people WHERE directory_id='person-27919bc641eb4710f2c5';

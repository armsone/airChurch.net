-- 개봉교회 역대 전도사 김민석(person-19843a648c82f247b1d6)과 거룩한빛광성교회 부목사 김민석은 동명이인이다.
-- 이름만으로 매칭한 초기 시딩이 광성교회 역할을 역대 인물에 붙였으므로,
-- 전용 인물(kwangsung-official-김민석)로 역할·사진·공개번호·교류 데이터를 옮기고 잘못된 역할만 제거한다.

-- 1. 광성교회 공식 김민석 전용 인물을 승인 상태로 보장한다.
INSERT INTO pastor_people (directory_id,name,review_status)
VALUES ('kwangsung-official-김민석','김민석','approved')
ON CONFLICT(directory_id) DO UPDATE SET name='김민석',review_status='approved',updated_at=CURRENT_TIMESTAMP;

-- 2. 역대 인물에 잘못 붙은 거룩한빛광성교회 역할을 전용 인물로 복사한다.
INSERT OR IGNORE INTO pastor_church_roles (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status)
SELECT dedicated.id,src.church_id,src.church_name,src.denomination,src.region,src.role_title,src.role_category,src.role_status,src.start_date,src.end_date,src.source_url,src.review_status
FROM pastor_church_roles src
JOIN pastor_people historical ON historical.id=src.pastor_id AND historical.directory_id='person-19843a648c82f247b1d6'
JOIN pastor_people dedicated ON dedicated.directory_id='kwangsung-official-김민석'
WHERE REPLACE(TRIM(COALESCE(src.church_name,'')),' ','')='거룩한빛광성교회';

-- 역대 인물에서 이미 정리된 경우를 대비해 전용 인물에 광성교회 역할이 없으면 공식 명단 기준으로 채운다.
INSERT OR IGNORE INTO pastor_church_roles (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,source_url,review_status)
SELECT dedicated.id,c.id,c.name,c.denomination,c.region,'부목사','associate','current','https://kwangsung.org/Page/Index/15','approved'
FROM pastor_people dedicated
JOIN churches c ON REPLACE(TRIM(c.name),' ','')='거룩한빛광성교회'
WHERE dedicated.directory_id='kwangsung-official-김민석'
  AND NOT EXISTS (SELECT 1 FROM pastor_church_roles r WHERE r.pastor_id=dedicated.id AND REPLACE(TRIM(COALESCE(r.church_name,'')),' ','')='거룩한빛광성교회')
LIMIT 1;

-- 3. 광성교회 공식 도메인 출처 사진을 전용 인물로 옮긴다(전용 인물에 사진이 없을 때만 복사).
UPDATE pastor_people
SET photo_url=(SELECT h.photo_url FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6'),
    photo_source_url=(SELECT h.photo_source_url FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6'),
    photo_sha256=(SELECT h.photo_sha256 FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6'),
    photo_usage_basis=(SELECT h.photo_usage_basis FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6'),
    photo_review_status=(SELECT h.photo_review_status FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6'),
    updated_at=CURRENT_TIMESTAMP
WHERE directory_id='kwangsung-official-김민석'
  AND TRIM(COALESCE(photo_url,''))=''
  AND EXISTS (SELECT 1 FROM pastor_people h WHERE h.directory_id='person-19843a648c82f247b1d6' AND TRIM(COALESCE(h.photo_url,''))<>'' AND COALESCE(h.photo_source_url,'') LIKE 'https://kwangsung.org/%');

-- 역대 인물의 사진은 출처가 광성교회 공식 도메인일 때만 비운다.
UPDATE pastor_people
SET photo_url=NULL,photo_source_url=NULL,photo_sha256=NULL,photo_usage_basis=NULL,photo_review_status='pending',updated_at=CURRENT_TIMESTAMP
WHERE directory_id='person-19843a648c82f247b1d6'
  AND COALESCE(photo_source_url,'') LIKE 'https://kwangsung.org/%';

-- 4. 역대 인물이 /pastors/2로 노출되던 경우에만, 그 프로필로 접수된 격려 메시지와 비공개 연락처를 전용 인물로 옮긴다.
UPDATE pastor_encouragement_messages
SET pastor_id=(SELECT id FROM pastor_people WHERE directory_id='kwangsung-official-김민석')
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-19843a648c82f247b1d6' AND public_id=2);

UPDATE pastor_private_contact_values
SET pastor_id=(SELECT id FROM pastor_people WHERE directory_id='kwangsung-official-김민석'),updated_at=CURRENT_TIMESTAMP
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-19843a648c82f247b1d6' AND public_id=2)
  AND NOT EXISTS (
    SELECT 1 FROM pastor_private_contact_values dup
    WHERE dup.pastor_id=(SELECT id FROM pastor_people WHERE directory_id='kwangsung-official-김민석')
      AND dup.contact_type=pastor_private_contact_values.contact_type
      AND dup.value_digest=pastor_private_contact_values.value_digest
  );

-- 전용 인물에 이미 같은 연락처가 있어 옮기지 못한 중복 행은 역대 인물에서 제거한다.
DELETE FROM pastor_private_contact_values
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-19843a648c82f247b1d6' AND public_id=2)
  AND EXISTS (
    SELECT 1 FROM pastor_private_contact_values dup
    WHERE dup.pastor_id=(SELECT id FROM pastor_people WHERE directory_id='kwangsung-official-김민석')
      AND dup.contact_type=pastor_private_contact_values.contact_type
      AND dup.value_digest=pastor_private_contact_values.value_digest
  );

-- 5. public_id 2를 전용 인물로 이전한다. 유니크 인덱스 충돌을 피하려고 역대 인물에 새 번호를 먼저 부여한다.
UPDATE pastor_people
SET public_id=(SELECT COALESCE(MAX(public_id),3)+1 FROM pastor_people),updated_at=CURRENT_TIMESTAMP
WHERE directory_id='person-19843a648c82f247b1d6' AND public_id=2;

UPDATE pastor_people
SET public_id=2,updated_at=CURRENT_TIMESTAMP
WHERE directory_id='kwangsung-official-김민석'
  AND COALESCE(public_id,-1)<>2
  AND NOT EXISTS (SELECT 1 FROM pastor_people other WHERE other.public_id=2 AND other.directory_id<>'kwangsung-official-김민석');

-- 6. 역대 인물에서 잘못된 거룩한빛광성교회 역할만 삭제한다. 개봉교회 역대 기록은 그대로 둔다.
DELETE FROM pastor_church_roles
WHERE pastor_id=(SELECT id FROM pastor_people WHERE directory_id='person-19843a648c82f247b1d6')
  AND REPLACE(TRIM(COALESCE(church_name,'')),' ','')='거룩한빛광성교회';

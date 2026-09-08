-- User-approved removal of 16 affiliations with 거룩한빛광성교회.
-- Keep pastor_people, photos, encouragements and every other church affiliation.
-- Per final user correction, leave 정성진 and 엄유현 entirely unchanged.
DELETE FROM pastor_church_roles
WHERE church_name='거룩한빛광성교회'
  AND pastor_id IN (
    SELECT id FROM pastor_people WHERE (public_id=15411 AND name='김환')
    OR (public_id=15412 AND name='문상원')
    OR (public_id=15414 AND name='박순심')
    OR (public_id=15419 AND name='윤화평')
    OR (public_id=15433 AND name='한요한')
    OR (public_id=15434 AND name='홍요한')
    OR (public_id=15447 AND name='신연섭')
    OR (public_id=15453 AND name='윤성로')
    OR (public_id=15454 AND name='응웬반떼')
    OR (public_id=15457 AND name='이대설')
    OR (public_id=15461 AND name='이재성')
    OR (public_id=15466 AND name='쯩티탄림')
    OR (public_id=15468 AND name='황경희')
    OR (public_id=15469 AND name='류후춘')
    OR (public_id=15470 AND name='전춘미')
    OR (public_id=15471 AND name='천영철')
  );

-- Also remove matching legacy entries to prevent their reappearance.
DELETE FROM church_ministry_profiles
WHERE church_id IN (SELECT id FROM churches WHERE public_id=1 AND name='거룩한빛광성교회')
  AND (name IN ('김환', '김환 목사', '문상원', '문상원 목사', '박순심', '박순심 목사', '윤화평', '윤화평 목사', '한요한', '한요한 목사', '홍요한', '홍요한 목사', '신연섭', '신연섭 목사', '윤성로', '윤성로 목사', '응웬반떼', '응웬반떼 목사', '이대설', '이대설 목사', '이재성', '이재성 목사', '쯩티탄림', '쯩티탄림 목사', '황경희', '황경희 목사', '류후춘', '류후춘 목사', '전춘미', '전춘미 목사', '천영철', '천영철 목사'));

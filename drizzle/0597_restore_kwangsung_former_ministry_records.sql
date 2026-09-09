-- Correct 0595: removing a current affiliation must retain the verified former ministry record.
-- These people are no longer shown as current staff at 거룩한빛광성교회.
WITH former_staff(public_id,name,role_title,role_category,source_url) AS (
  VALUES
    (15411,'김환','부목사','associate','https://kwangsung.org/Page/Index/15'),
    (15412,'문상원','부목사','associate','https://kwangsung.org/Page/Index/15'),
    (15414,'박순심','준전임목사','associate','https://kwangsung.org/Page/Index/16'),
    (15419,'윤화평','부목사','associate','https://kwangsung.org/Page/Index/15'),
    (15433,'한요한','부목사','associate','https://kwangsung.org/Page/Index/15'),
    (15434,'홍요한','준전임목사','associate','https://kwangsung.org/Page/Index/16'),
    (15434,'홍요한','준전임전도사','education','https://kwangsung.org/Page/Index/16'),
    (15447,'신연섭','준전임전도사','education','https://kwangsung.org/Page/Index/16'),
    (15453,'윤성로','교육목사','education','https://kwangsung.org/Page/Index/17'),
    (15454,'응웬반떼','교육전도사','education','https://kwangsung.org/Page/Index/17'),
    (15457,'이대설','준전임전도사','education','https://kwangsung.org/Page/Index/16'),
    (15461,'이재성','교육전도사','education','https://kwangsung.org/Page/Index/17'),
    (15466,'쯩티탄림','교육전도사','education','https://kwangsung.org/Page/Index/17'),
    (15468,'황경희','교육선교사','education','https://kwangsung.org/Page/Index/17'),
    (15469,'류후춘','협동전도사','cooperating','https://kwangsung.org/Page/Index/19'),
    (15470,'전춘미','협동전도사','cooperating','https://kwangsung.org/Page/Index/19'),
    (15471,'천영철','협동목사','cooperating','https://kwangsung.org/Page/Index/19')
)
INSERT OR IGNORE INTO pastor_church_roles (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status)
SELECT p.id,c.id,c.name,c.denomination,c.region,staff.role_title,staff.role_category,'former',NULL,NULL,staff.source_url,'approved'
FROM former_staff staff
JOIN pastor_people p ON p.public_id=staff.public_id AND p.name=staff.name
JOIN churches c ON c.public_id=1 AND c.name='거룩한빛광성교회';

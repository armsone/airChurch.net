-- Official history pages previously misclassified as current ministry rosters.
-- People remain published; only their matching church-role relationship becomes former.
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.ocjeil.or.kr/page/sub01_3'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.ocjeil.or.kr/page/sub01_3';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.scdch.org/Page/Index/1594'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.scdch.org/Page/Index/1594';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.samyangtv.com/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.samyangtv.com/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.naesoo.or.kr/Page/Index/11'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.naesoo.or.kr/Page/Index/11';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://jr.or.kr/%ec%97%b0%ed%98%81/'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://jr.or.kr/%ec%97%b0%ed%98%81/';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://dongilro.org/history/'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://dongilro.org/history/';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.smyrna.or.kr/Page/Index/11771'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.smyrna.or.kr/Page/Index/11771';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.dong-mun.org/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.dong-mun.org/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.godislife.or.kr/Page/Index/18'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.godislife.or.kr/Page/Index/18';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sungsanchurch.com/bbs/board.php?bo_table=sub01_03'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sungsanchurch.com/bbs/board.php?bo_table=sub01_03';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.hud1937.org/bbs/board.php?bo_table=sub01_02'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.hud1937.org/bbs/board.php?bo_table=sub01_02';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.suboo.or.kr/page_UWlS30'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.suboo.or.kr/page_UWlS30';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.lsc.or.kr/Page/Index/16'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.lsc.or.kr/Page/Index/16';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.yesusarang.org/Page/Index/14'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.yesusarang.org/Page/Index/14';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://cem.or.kr/pud/index.php?group_code=pud&category_id=154&p_cate_id=154&m_id=215'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://cem.or.kr/pud/index.php?group_code=pud&category_id=154&p_cate_id=154&m_id=215';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.inhappy.org/today'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.inhappy.org/today';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://sungsanch.or.kr/amina/html.php?hid=a_03'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://sungsanch.or.kr/amina/html.php?hid=a_03';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sygc.org/Page/Index/8'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sygc.org/Page/Index/8';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://xn--v69aqqg51a1vh8piyrw.com/?page_id=147146'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://xn--v69aqqg51a1vh8piyrw.com/?page_id=147146';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.iyoungdong.org/Page/Index/19'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.iyoungdong.org/Page/Index/19';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.iyoungdong.org/Page/Index/18'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.iyoungdong.org/Page/Index/18';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.hkc.or.kr/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.hkc.or.kr/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://jdjp.org/?page_id=147125'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://jdjp.org/?page_id=147125';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.sungseo.kr/0d24fb1c-ce4e-8269-b7ed-0195466885ec'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.sungseo.kr/0d24fb1c-ce4e-8269-b7ed-0195466885ec';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.jesusheart.org/index.php?mid=page_SNED27'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.jesusheart.org/index.php?mid=page_SNED27';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.jpc0691.or.kr/amina/html.php?hid=aa_04'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.jpc0691.or.kr/amina/html.php?hid=aa_04';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.ykc.or.kr/Page/Index/641'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.ykc.or.kr/Page/Index/641';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.hakik.net/bbs/board.php?bo_table=history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.hakik.net/bbs/board.php?bo_table=history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.cheomdan.or.kr/Page/Index/21'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.cheomdan.or.kr/Page/Index/21';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://samgwang.or.kr/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://samgwang.or.kr/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.yejun.or.kr/Page/Index/15'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.yejun.or.kr/Page/Index/15';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.jejudongdo.org/?page_id=1937'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.jejudongdo.org/?page_id=1937';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.ahyun.org/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.ahyun.org/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sungmoon.or.kr/bbs/content.php?co_id=info03'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sungmoon.or.kr/bbs/content.php?co_id=info03';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.eunsam.net/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.eunsam.net/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://inkwang.net/wp/?page_id=11537'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://inkwang.net/wp/?page_id=11537';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://osgtv.org/189'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://osgtv.org/189';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.nogok.or.kr/board1_5'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.nogok.or.kr/board1_5';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.sndch.com/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.sndch.com/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.opodaybreak.org/bbs/board.php?bo_table=history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.opodaybreak.org/bbs/board.php?bo_table=history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.kangso.org/page_info2'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.kangso.org/page_info2';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.ijungang.net/bbs/board.php?bo_table=history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.ijungang.net/bbs/board.php?bo_table=history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.chjlove4u.net/bbs/content.php?co_id=chj_history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.chjlove4u.net/bbs/content.php?co_id=chj_history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://seobuchurch.org/church-info/church-history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://seobuchurch.org/church-info/church-history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.msgb.or.kr/page/sub1_3.php'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.msgb.or.kr/page/sub1_3.php';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://yhoryun.org/pud/index.php?group_code=pud&category_id=122&p_cate_id=122&m_id=130'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://yhoryun.org/pud/index.php?group_code=pud&category_id=122&p_cate_id=122&m_id=130';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.dmchurch.kr/p9'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.dmchurch.kr/p9';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.gyungshin.or.kr/Page/Index/13804'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.gyungshin.or.kr/Page/Index/13804';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.gaebong.or.kr/Page/Index/16'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.gaebong.or.kr/Page/Index/16';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.dongcheon.or.kr/103.php'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.dongcheon.or.kr/103.php';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.bangcho.or.kr/page/sub09'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.bangcho.or.kr/page/sub09';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.moohak.org/Page/Index/18'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.moohak.org/Page/Index/18';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.dongilch.com/Page/Index/102156'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.dongilch.com/Page/Index/102156';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.dongilch.com/Page/Index/25'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.dongilch.com/Page/Index/25';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.skpc.kr/Page/Index/14'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.skpc.kr/Page/Index/14';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sjhpc.or.kr/Page/Index/14'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sjhpc.or.kr/Page/Index/14';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.shin-sung.or.kr/bbs/board.php?bo_table=history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.shin-sung.or.kr/bbs/board.php?bo_table=history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.amazinggrace.or.kr/kor/sub02/menu_04_2.html'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.amazinggrace.or.kr/kor/sub02/menu_04_2.html';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://kayach.org/bbs/board.php?bo_table=sub01_04'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://kayach.org/bbs/board.php?bo_table=sub01_04';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.heesung.or.kr/Page/Index/16'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.heesung.or.kr/Page/Index/16';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.gupo.org/Page/Index/15'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.gupo.org/Page/Index/15';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.yjrch.or.kr/bbs/board.php?bo_table=ysub01_02'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.yjrch.or.kr/bbs/board.php?bo_table=ysub01_02';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.allak.or.kr/Page/Index/26'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.allak.or.kr/Page/Index/26';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.dmmc.or.kr/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.dmmc.or.kr/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.firstch.org/Page/Index/862'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.firstch.org/Page/Index/862';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sungan153.com/Page/Index/20344'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sungan153.com/Page/Index/20344';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.sungkwang.or.kr/Page/Index/12'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.sungkwang.or.kr/Page/Index/12';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sandolchurch.or.kr/48'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sandolchurch.or.kr/48';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sandolchurch.or.kr/2020s_history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sandolchurch.or.kr/2020s_history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.sandolchurch.or.kr/2010s_history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.sandolchurch.or.kr/2010s_history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.ds1004.or.kr/daesung/sub0102.php'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.ds1004.or.kr/daesung/sub0102.php';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.first.or.kr/Page/Index/17'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.first.or.kr/Page/Index/17';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://haksung.org/%ea%b5%90%ed%9a%8c%ec%97%b0%ed%98%81/'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://haksung.org/%ea%b5%90%ed%9a%8c%ec%97%b0%ed%98%81/';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.godone.or.kr/info/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.godone.or.kr/info/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.nlcc.or.kr/Page/Index/71'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.nlcc.or.kr/Page/Index/71';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.bokdoen.or.kr/Page/Index/11920'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.bokdoen.or.kr/Page/Index/11920';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://xn--9d0b563ahyb4y0b.aub.kr/bbs/board.php?bo_table=bo_36709'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://xn--9d0b563ahyb4y0b.aub.kr/bbs/board.php?bo_table=bo_36709';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://hosanna57.org/contents.php?gr=1&page=3'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://hosanna57.org/contents.php?gr=1&page=3';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.hansomang.org/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.hansomang.org/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://dowonch.com/bbs/page.php?hid=history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://dowonch.com/bbs/page.php?hid=history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://pyungchon.or.kr/home/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://pyungchon.or.kr/home/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.pyungchon.or.kr/home/history/'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.pyungchon.or.kr/home/history/';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://wooyi.or.kr/Page/Index/12'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://wooyi.or.kr/Page/Index/12';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://ycmc.church/%EA%B5%90%ED%9A%8C%EC%86%8C%EA%B0%9C/%EA%B5%90%ED%9A%8C%EC%97%B0%ED%98%81'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://ycmc.church/%EA%B5%90%ED%9A%8C%EC%86%8C%EA%B0%9C/%EA%B5%90%ED%9A%8C%EC%97%B0%ED%98%81';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.hanmaeum.or.kr/board1_4'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.hanmaeum.or.kr/board1_4';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://servingjesus.co.kr/Page/Index/12'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://servingjesus.co.kr/Page/Index/12';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://i-seongsan.or.kr/Page/Index/33'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://i-seongsan.or.kr/Page/Index/33';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://incheonjeil.com/introduce/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://incheonjeil.com/introduce/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.sion.or.kr/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.sion.or.kr/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://vision5000.or.kr/Page/Index/24'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://vision5000.or.kr/Page/Index/24';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.scjeil.org/Page/Index/13'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.scjeil.org/Page/Index/13';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://www.samchun.or.kr/Page/Index/23'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://www.samchun.or.kr/Page/Index/23';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://ssjmc.com/history'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://ssjmc.com/history';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='http://firstch21.net/Page/Index/11'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='http://firstch21.net/Page/Index/11';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.jejaks.org/Page/Index/829'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.jejaks.org/Page/Index/829';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.sja.or.kr/Page/Index/27499'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.sja.or.kr/Page/Index/27499';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.cjfull.or.kr/Page/Index/13605'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.cjfull.or.kr/Page/Index/13605';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://www.kjfc.or.kr/Page/Index/14'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://www.kjfc.or.kr/Page/Index/14';
DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.source_url='https://bnpc.or.kr/page_YQTc26'
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.source_url='https://bnpc.or.kr/page_YQTc26';

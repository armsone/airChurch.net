"""Collect a fixed, reviewed selection of KRV passages; never generate Bible text."""
import concurrent.futures, html, json, re, time, urllib.request
from pathlib import Path

GROUPS = {
'advent': 'ISA.7.14 ISA.9.2 ISA.9.6 ISA.11.1 ISA.11.2 ISA.11.9 ISA.40.3 ISA.40.5 ISA.40.8 ISA.40.11 ISA.40.31 ISA.52.7 ISA.60.1 JER.23.5 MIC.5.2 MAL.3.1 MAL.4.2 PSA.24.7 PSA.27.14 PSA.130.5 ROM.13.12 ROM.15.13 JAS.5.8 REV.22.20',
'christmas': 'LUK.1.30-31 LUK.1.32 LUK.1.38 LUK.1.46-47 LUK.1.49 LUK.1.68 LUK.1.78-79 LUK.2.10 LUK.2.11 LUK.2.14 LUK.2.19 LUK.2.20 MAT.1.21 MAT.1.23 JHN.1.1 JHN.1.4 JHN.1.9 JHN.1.14 JHN.1.16 GAL.4.4-5 TIT.2.11 1JN.4.9',
'epiphany': 'MAT.2.10-11 MAT.3.16-17 MAT.4.16 MAT.4.19 MAT.5.14 MAT.5.16 MRK.1.11 MRK.1.15 LUK.2.30-32 LUK.4.18 LUK.4.19 JHN.1.29 JHN.1.41 JHN.1.45 JHN.2.11 JHN.3.16 JHN.3.17 JHN.4.24 JHN.6.35 JHN.7.38 JHN.8.12 JHN.10.11 JHN.12.46 2CO.4.6',
'lent': 'PSA.32.1 PSA.51.1 PSA.51.10 PSA.51.17 ISA.53.4 ISA.53.5 ISA.55.6 ISA.55.7 JOL.2.12 JOL.2.13 MIC.6.8 MAT.4.4 MAT.6.6 MAT.6.21 MAT.11.28 MAT.16.24 MAT.26.41 MRK.8.34 MRK.10.45 LUK.9.23 LUK.15.7 LUK.18.13 LUK.23.34 JHN.12.24 JHN.13.34 ROM.5.8 2CO.5.21 GAL.2.20 PHP.2.8 HEB.4.16 HEB.12.2 1PE.2.24',
'easter': 'MAT.28.6 MAT.28.20 MRK.16.6 LUK.24.6 LUK.24.32 LUK.24.46-47 JHN.11.25 JHN.11.26 JHN.14.19 JHN.16.22 JHN.20.19 JHN.20.21 JHN.20.29 JHN.20.31 ACT.2.24 ACT.3.15 ACT.4.12 ACT.10.40 ROM.4.25 ROM.6.4 ROM.6.9 ROM.6.11 ROM.8.11 ROM.8.34 1CO.15.20 1CO.15.21 1CO.15.22 1CO.15.54 1CO.15.57 2CO.5.17 PHP.3.10 COL.3.1 COL.3.2 1PE.1.3 REV.1.18 REV.21.4',
'ordinary': 'PSA.1.1-2 PSA.4.8 PSA.16.8 PSA.16.11 PSA.19.14 PSA.23.1 PSA.23.3 PSA.23.4 PSA.27.1 PSA.28.7 PSA.29.11 PSA.34.8 PSA.34.18 PSA.37.4 PSA.37.5 PSA.46.1 PSA.46.10 PSA.55.22 PSA.62.1 PSA.62.5 PSA.63.3 PSA.73.26 PSA.84.11 PSA.90.12 PSA.91.1 PSA.95.1 PSA.100.2 PSA.100.4 PSA.103.2 PSA.103.8 PSA.118.24 PSA.119.11 PSA.119.105 PSA.121.1-2 PSA.133.1 PSA.139.23-24 PSA.145.9 PRO.3.5-6 PRO.4.23 PRO.10.12 PRO.11.25 PRO.15.1 PRO.16.3 PRO.16.9 PRO.17.17 PRO.18.10 PRO.19.17 PRO.27.17 ECC.3.1 ECC.4.9-10 ISA.26.3 ISA.41.10 ISA.43.2 ISA.58.11 LAM.3.22-23 MAT.5.7 MAT.5.9 MAT.6.33 MAT.7.7 MAT.7.12 MAT.11.29-30 MAT.22.37-39 MRK.9.23 MRK.11.24 LUK.6.31 LUK.6.36 JHN.14.27 JHN.15.5 JHN.15.12 JHN.15.13 ACT.1.8 ACT.2.17 ACT.2.38 ROM.8.14 ROM.8.26 ROM.12.2 ROM.12.10 ROM.12.12 ROM.12.18 ROM.12.21 ROM.14.17 ROM.15.5 ROM.15.7 1CO.10.13 1CO.13.4-5 1CO.13.13 1CO.16.14 2CO.1.4 2CO.3.17 2CO.9.7 2CO.12.9 GAL.5.16 GAL.5.22-23 GAL.6.2 GAL.6.9 GAL.6.10 EPH.2.10 EPH.4.2 EPH.4.3 EPH.4.29 EPH.4.32 EPH.5.2 EPH.5.20 PHP.1.6 PHP.2.3 PHP.2.4 PHP.4.4 PHP.4.6-7 PHP.4.8 PHP.4.13 COL.3.12 COL.3.13 COL.3.14 COL.3.15 COL.3.16 COL.3.17 COL.3.23 1TH.5.11 1TH.5.16-18 2TH.3.16 2TI.1.7 2TI.3.16-17 HEB.10.24 HEB.11.1 HEB.13.2 HEB.13.16 JAS.1.5 JAS.1.17 JAS.1.19 JAS.1.22 JAS.3.17 JAS.4.8 1PE.4.8 1PE.4.10 1PE.5.7 1JN.3.18 1JN.4.7 1JN.4.11 1JN.4.19'
}
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'work/daily-scripture/pages';CACHE.mkdir(parents=True,exist_ok=True)
def collect(pair):
 group,path=pair; url=f'https://www.bible.com/ko/bible/88/{path}.KRV'; target=CACHE/(path+'.html')
 for attempt in range(3):
  try:
   raw=target.read_text() if target.exists() else urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20).read().decode()
   title=re.search(r'<h1[^>]*>(.*?)</h1>',raw,re.S)
   if not title:raise ValueError('missing reference')
   reference=html.unescape(re.sub('<[^>]+>','',title.group(1))).strip()
   fragment=raw[title.end():]
   body=re.search(r'<p class="[^"]*font-medium mbe-2[^"]*">(.*?)</p>',fragment,re.S)
   if not body:raise ValueError('missing full verse body')
   text=html.unescape(re.sub('<[^>]+>','',body.group(1))).strip()
   if len(text)<5 or not re.search('[가-힣]',text) or '…' in text:raise ValueError('invalid text')
   target.write_text(raw)
   return {'path':path,'reference':reference,'text':text,'season':group,'sourceUrl':url}
  except Exception as error:
   if attempt==2:raise RuntimeError(f'{path}: {error}')
   time.sleep(2*(attempt+1))
if __name__=='__main__':
 pairs=[(g,p) for g,ps in GROUPS.items() for p in ps.split()]
 rows=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for i,row in enumerate(pool.map(collect,pairs)):
   rows.append(row)
   if (i+1)%25==0:print(f'Collected {i+1}/{len(pairs)}',flush=True)
 if len({r['path'] for r in rows})!=len(rows):raise ValueError('duplicate passages')
 (ROOT/'data/daily-scriptures.json').write_text(json.dumps({'translation':'성경전서 개역한글판','attribution':'대한성서공회','verifiedAt':'2026-09-12','copyrightSource':'https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5','items':rows},ensure_ascii=False,indent=2)+'\n')
 print(f'Saved {len(rows)} verified passages',flush=True)

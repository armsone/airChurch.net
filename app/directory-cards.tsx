import type {ReactNode} from "react";

const denominationMarks:Record<string,{src:string;alt:string}>={
  "대한예수교장로회 통합":{src:"/denominations/pck-tonghap.png",alt:"대한예수교장로회 통합 교단 심볼"},
  "대한예수교장로회 합동":{src:"/denominations/pck-hapdong.svg",alt:"대한예수교장로회 합동 교단 심볼"},
  "기독교대한감리회":{src:"/denominations/kmc.ico",alt:"기독교대한감리회 교단 심볼"},
  "대한예수교장로회 고신":{src:"/denominations/pck-kosin.jpg",alt:"대한예수교장로회 고신 교단 심볼"},
  "기독교한국침례회":{src:"/denominations/kbch.png",alt:"기독교한국침례회 공식 로고"},
  "기독교대한성결교회":{src:"/denominations/kehc-256.png",alt:"기독교대한성결교회 교단 심볼"},
  "대한예수교장로회 합신":{src:"/denominations/pck-hapshin.png",alt:"대한예수교장로회 합신 공식 로고"},
  "대한예수교장로회 백석":{src:"/denominations/pck-baekseok-256.png",alt:"대한예수교장로회 백석 교단 심볼"},
  "기독교대한하나님의성회":{src:"/denominations/agk.png",alt:"기독교대한하나님의성회 공식 로고"},
  "기독교대한하나님의성회 광화문총회":{src:"/denominations/agk-gwanghwamun.png",alt:"기독교대한하나님의성회 광화문총회 공식 로고"},
  "한국기독교장로회":{src:"/denominations/prok-256.png",alt:"한국기독교장로회 교단 심볼"},
  "한국독립교회선교단체연합회":{src:"/denominations/kaicam.png",alt:"한국독립교회선교단체연합회 공식 로고"},
};

export const denominationMark=(denomination:string)=>denominationMarks[denomination]??null;

export function ChurchCardContent({id,churchHref,name,pastor,pastorHref,region,regionId,denomination,homepageUrl,youtubeChannelId,channelImageUrl,selection,saveAction,badge,detail}:Readonly<{id?:number|null;churchHref?:string|null;name:string;pastor:string;pastorHref?:string|null;region:string;regionId?:string;denomination:string;homepageUrl?:string|null;youtubeChannelId?:string|null;channelImageUrl?:string|null;selection?:ReactNode;saveAction?:ReactNode;badge?:ReactNode;detail?:ReactNode}>){
  const mark=denominationMark(denomination);
  const href=churchHref??(id!==null&&id!==undefined?`/church/${id}`:null);
  return <div className="shared-church-card-content"><div className="church-directory-top"><div className="shared-card-region">{selection}<span id={regionId}>{region}</span></div><div className="church-directory-top-actions">{badge}{mark&&<img className="church-denomination-mark" src={mark.src} alt={mark.alt} width={21} height={21} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}{saveAction}</div></div><h3>{href?<a className="church-primary-link" href={href}>{name}</a>:name}</h3><div className="church-directory-meta"><div className="church-directory-meta-copy"><p>{pastorHref?<a href={pastorHref}>{pastor}</a>:pastor}</p><small>{denomination}</small>{detail}</div><div className="church-directory-links">{homepageUrl&&<a className="homepage-link" href={homepageUrl} target="_blank" rel="noreferrer" title={`${name} 공식 홈페이지`} aria-label={`${name} 공식 홈페이지 열기`}><span className="homepage-visual" aria-hidden="true"><span>⛪</span>{channelImageUrl&&<img src={channelImageUrl} alt="" width={27} height={27} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}</span></a>}{youtubeChannelId&&<a className="youtube-link" href={`https://www.youtube.com/channel/${youtubeChannelId}`} target="_blank" rel="noreferrer" title={`${name} 공식 YouTube`} aria-label={`${name} 공식 YouTube 열기`}><span className="directory-icon youtube-icon" aria-hidden="true"/></a>}</div></div></div>;
}

export function PastorCardContent({name,href,photoUrl,hasPhoto,roleStatus,roles,churchName,churchHref,region,denomination,sourceUrl,selection,saveAction,detail}:Readonly<{name:string;href:string;photoUrl:string;hasPhoto?:boolean;roleStatus?:string|null;roles:string[];churchName?:string|null;churchHref?:string|null;region?:string|null;denomination?:string|null;sourceUrl?:string|null;selection?:ReactNode;saveAction?:ReactNode;detail?:ReactNode}>){
  return <div className="shared-pastor-card-content">{selection}<div className="pastor-directory-card"><span className={`pastor-directory-photo${hasPhoto?" has-photo":" is-placeholder"}`}><img src={photoUrl} alt={hasPhoto?`${name} 목회자`:""} width={92} height={116} loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span><span className="pastor-directory-copy"><span className="pastor-directory-status">{roleStatus==="former"?"사역 이력":"현재 사역"}</span><span className="pastor-directory-name-row"><strong><a href={href}>{name}</a></strong><span className="pastor-directory-roles">{roles.map((role)=><b key={role}>{role}</b>)}</span></span>{churchName&&(churchHref?<p><a href={churchHref}>{churchName}</a></p>:<p>{churchName}</p>)}{region&&<small className="pastor-directory-region">{region}</small>}{denomination&&<small className="pastor-directory-denomination">{denomination}</small>}{sourceUrl&&<a className="pastor-source-link" href={sourceUrl} target="_blank" rel="noreferrer">공식 출처 확인 ↗</a>}{detail}</span></div>{saveAction}</div>;
}

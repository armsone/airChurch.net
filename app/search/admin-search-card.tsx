"use client";

import {isValidElement,type ReactNode} from "react";
import {AdminBulkCheckbox} from "../admin-bulk-selection";

export default function AdminSearchCard({admin,href,label,className,children,controls,linksOnly=false,selection}:{admin:boolean;href:string;label:string;className:string;children:ReactNode;controls?:ReactNode;linksOnly?:boolean;selection?:{kind:"church"|"pastor";id:number}}){
  if(!admin)return linksOnly?<article className={className}>{children}</article>:<a href={href} className={className}>{children}</a>;
  const controlId=isValidElement<{id?:number}>(controls)?controls.props.id:undefined,inferredSelection=selection??(typeof controlId==="number"?{kind:href.startsWith("/pastors/")?"pastor" as const:"church" as const,id:controlId}:undefined);
  const toggle=(element:HTMLElement)=>{const details=element.querySelector<HTMLDetailsElement>(".admin-church-details,.admin-pastor-details");if(details)details.open=!details.open;};
  return <article className={`${className} is-admin-card`} role="button" tabIndex={0} aria-label={`${label} 관리 열기`} onClick={(event)=>{if((event.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary,.admin-church-details,.admin-pastor-details"))return;toggle(event.currentTarget);}} onKeyDown={(event)=>{if(event.target!==event.currentTarget||!["Enter"," "].includes(event.key))return;event.preventDefault();toggle(event.currentTarget);}}>{inferredSelection&&<AdminBulkCheckbox kind={inferredSelection.kind} id={inferredSelection.id} label={label}/>}<div className="admin-search-card-body">{children}</div>{controls}</article>;
}

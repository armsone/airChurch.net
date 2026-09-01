"use client";

import type {ReactNode} from "react";

export default function AdminSearchCard({admin,href,label,className,children,controls}:{admin:boolean;href:string;label:string;className:string;children:ReactNode;controls?:ReactNode}){
  if(!admin)return <a href={href} className={className}>{children}</a>;
  const toggle=(element:HTMLElement)=>{const details=element.querySelector<HTMLDetailsElement>(".admin-church-details,.admin-pastor-details");if(details)details.open=!details.open;};
  return <article className={`${className} is-admin-card`} role="button" tabIndex={0} aria-label={`${label} 관리 열기`} onClick={(event)=>{if((event.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary,.admin-church-details,.admin-pastor-details"))return;toggle(event.currentTarget);}} onKeyDown={(event)=>{if(event.target!==event.currentTarget||!["Enter"," "].includes(event.key))return;event.preventDefault();toggle(event.currentTarget);}}><div className="admin-search-card-body">{children}</div>{controls}</article>;
}

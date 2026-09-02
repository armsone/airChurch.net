"use client";

import type {ReactNode} from "react";
import {PastorControls,type PastorControlProps} from "./admin/admin-controls";
import {AdminBulkCheckbox} from "./admin-bulk-selection";
import {PastorCardContent} from "./directory-cards";

type Props={
  name:string;
  href:string;
  photoUrl:string;
  hasPhoto?:boolean;
  roleStatus?:string|null;
  roles:string[];
  churchName?:string|null;
  churchHref?:string|null;
  region?:string|null;
  denomination?:string|null;
  sourceUrl?:string|null;
  saveAction?:ReactNode;
  detail?:ReactNode;
  selection?:ReactNode;
  admin?:boolean;
  editor?:PastorControlProps;
  useGlobalSelection?:boolean;
  className?:string;
};

export default function PastorDirectoryCard({name,href,photoUrl,hasPhoto,roleStatus,roles,churchName,churchHref,region,denomination,sourceUrl,saveAction,detail,selection,admin=false,editor,useGlobalSelection=true,className=""}:Readonly<Props>){
  const editable=Boolean(admin&&editor);
  const toggle=(card:HTMLElement)=>{const details=card.querySelector<HTMLDetailsElement>(":scope > .admin-pastor-details");if(details)details.open=!details.open;};
  return <article className={`pastor-home-card shared-pastor-card${editable?" is-admin-card":""}${className?` ${className}`:""}`} role={editable?"button":undefined} tabIndex={editable?0:undefined} aria-label={editable?`${name} 목회자 관리 열기`:undefined} onClick={editable?(event)=>{if((event.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary,.admin-pastor-details"))return;toggle(event.currentTarget);}:undefined} onKeyDown={editable?(event)=>{if(event.target!==event.currentTarget||!["Enter"," "].includes(event.key))return;event.preventDefault();toggle(event.currentTarget);}:undefined}>
    {editable&&editor&&useGlobalSelection&&<AdminBulkCheckbox kind="pastor" id={editor.id} label={name}/>} 
    <div className="admin-search-card-body"><PastorCardContent name={name} href={href} photoUrl={photoUrl} hasPhoto={hasPhoto} roleStatus={roleStatus} roles={roles} churchName={churchName} churchHref={churchHref} region={region} denomination={denomination} sourceUrl={sourceUrl} selection={selection} saveAction={saveAction} detail={detail}/></div>
    {editable&&editor&&<PastorControls {...editor}/>} 
  </article>;
}

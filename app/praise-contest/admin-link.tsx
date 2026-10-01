"use client";
import {useEffect,useState} from "react";
export default function ContestAdminLink(){
 const [admin,setAdmin]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch("/api/admin/session",{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():null).then(session=>{if(!controller.signal.aborted)setAdmin(session?.role==="admin");}).catch(()=>{});return()=>controller.abort();},[]);
 return admin?<p><a className="unified-other-button" href="/admin/praise-contest">이벤트 관리 · 참가작 수정·삭제 →</a></p>:null;
}

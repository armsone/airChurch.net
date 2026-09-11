"use client";

import {useState,type ImgHTMLAttributes} from "react";

type Props=Omit<ImgHTMLAttributes<HTMLImageElement>,"src">&{src?:string;fallbackSrc?:string;fallbackLabel?:string};

export default function DirectoryImage({src,alt="",fallbackSrc,fallbackLabel,...props}:Props){
  const [failedSource,setFailedSource]=useState<string>();
  const failed=failedSource===src;
  if(failed&&!fallbackSrc)return fallbackLabel?<span className="directory-image-unavailable" role="img" aria-label={fallbackLabel}>{fallbackLabel}</span>:null;
  return <img {...props} src={failed?fallbackSrc:src} alt={failed?"사진을 불러올 수 없습니다":alt} title={failed?"사진을 불러올 수 없습니다":props.title} onError={()=>setFailedSource(src)}/>;
}

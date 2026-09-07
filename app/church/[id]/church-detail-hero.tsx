"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type Rgb = [number, number, number];

function cssRgb([red, green, blue]:Rgb, alpha?:number) {
  return alpha === undefined ? `rgb(${red} ${green} ${blue})` : `rgb(${red} ${green} ${blue} / ${alpha})`;
}
function shade([red, green, blue]:Rgb, amount:number):Rgb {
  return [red, green, blue].map((value)=>Math.round(value + (amount < 0 ? value : 255 - value) * amount)) as Rgb;
}
function dominantColor(image:HTMLImageElement):Rgb|null {
  const canvas=document.createElement("canvas");canvas.width=32;canvas.height=32;
  const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)return null;
  context.drawImage(image,0,0,32,32);const pixels=context.getImageData(0,0,32,32).data;let weighted:[number,number,number,number]=[0,0,0,0];
  for(let index=0;index<pixels.length;index+=4){
    const alpha=pixels[index+3]/255,red=pixels[index],green=pixels[index+1],blue=pixels[index+2],max=Math.max(red,green,blue),min=Math.min(red,green,blue),saturation=max===0?0:(max-min)/max;
    if(alpha<0.5||(max>248&&min>238)||max<28||saturation<0.12)continue;
    const weight=alpha*saturation*(0.45+max/255);weighted=[weighted[0]+red*weight,weighted[1]+green*weight,weighted[2]+blue*weight,weighted[3]+weight];
  }
  return weighted[3]>0?weighted.slice(0,3).map((value)=>Math.round(value/weighted[3])) as Rgb:null;
}

export default function ChurchDetailHero({image,publicId,name,pastor,region,denomination,primaryPerson,children}:{image:string|null;publicId:number;name:string;pastor:string;region:string;denomination:string;primaryPerson:{public_id:number}|undefined;children:ReactNode}){
  const imageRef=useRef<HTMLImageElement>(null);const [accent,setAccent]=useState<Rgb|null>(null);
  useEffect(()=>{const imageElement=imageRef.current;if(!imageElement)return;const updateColor=()=>{try{setAccent(dominantColor(imageElement));}catch{/* 외부 이미지가 색상 읽기를 허용하지 않으면 기본 팔레트를 사용합니다. */}};if(imageElement.complete)updateColor();else imageElement.addEventListener("load",updateColor);return()=>imageElement.removeEventListener("load",updateColor);},[image]);
  const style=accent?{"--church-hero-start":cssRgb(shade(accent,-0.56)),"--church-hero-end":cssRgb(shade(accent,-0.32)),"--church-hero-glow":cssRgb(accent,0.3)} as React.CSSProperties:undefined;
  return <section className={`church-detail-hero${accent?" has-logo-palette":""}`} style={style} id="primary-content" tabIndex={-1}><div className="church-detail-identity">{image?<img ref={imageRef} src={image} alt="" width={96} height={96} loading="eager" decoding="async" referrerPolicy="no-referrer"/>:<span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{name}</h1><p><a className="church-pastor-profile-link" href={primaryPerson?`/pastors/${primaryPerson.public_id}`:`/church/${publicId}`}>{pastor} 목회 기록 보기 →</a> · {region} · {denomination}</p></div></div><div className="church-detail-actions">{children}</div></section>;
}

export function LogoPaletteSection({image,className,children}:{image:string|null;className:string;children:ReactNode}){
  const imageRef=useRef<HTMLImageElement>(null);const [accent,setAccent]=useState<Rgb|null>(null);
  useEffect(()=>{const imageElement=imageRef.current;if(!imageElement)return;const updateColor=()=>{try{setAccent(dominantColor(imageElement));}catch{/* 외부 이미지가 색상 읽기를 허용하지 않으면 기본 팔레트를 사용합니다. */}};if(imageElement.complete)updateColor();else imageElement.addEventListener("load",updateColor);return()=>imageElement.removeEventListener("load",updateColor);},[image]);
  const style=accent?{"--church-hero-start":cssRgb(shade(accent,-0.56)),"--church-hero-end":cssRgb(shade(accent,-0.32)),"--church-hero-glow":cssRgb(accent,0.3)} as React.CSSProperties:undefined;
  return <section className={`${className}${accent?" has-logo-palette":""}`} style={style}>{image&&<img ref={imageRef} className="logo-palette-source" src={image} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer"/>}{children}</section>;
}

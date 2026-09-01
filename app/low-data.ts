export function shouldUseLowData(saveData:boolean|undefined,effectiveType:string|undefined,narrowViewport:boolean){
  return saveData===true||["slow-2g","2g","3g"].includes(effectiveType??"")||narrowViewport;
}

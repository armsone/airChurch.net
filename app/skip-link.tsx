export default function SkipLink({target="primary-content"}:{target?:string}){return <a className="skip-link" href={`#${target}`}>본문으로 건너뛰기</a>;}

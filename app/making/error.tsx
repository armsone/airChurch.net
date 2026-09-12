"use client";
export default function MakingError({reset}:{reset:()=>void}){return <main className="making-shell"><h1>글을 불러오지 못했습니다</h1><p>잠시 후 다시 시도해 주세요.</p><button onClick={reset}>다시 불러오기</button> <a href="/">첫 화면으로</a></main>;}

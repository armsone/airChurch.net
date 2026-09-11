import ContestBoard from "../contest-board";
import "../contest.css";
export const metadata={title:"찬양대회 8개 예시 미리보기",robots:{index:false,follow:false}};
export default function PreviewPage(){return <main className="contest-shell"><ContestBoard preview/></main>;}

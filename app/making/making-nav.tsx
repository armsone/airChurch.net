export default function MakingNav({ current }: { current: "notes" | "tech" | "history" | "theme" }) {
  return <nav className="making-nav" aria-label="에어처치 만들기"><a href="/making" aria-current={current === "notes" ? "page" : undefined}>조사와 고민</a><a href="/tech" aria-current={current === "tech" ? "page" : undefined}>테크</a><a href="/history" aria-current={current === "history" ? "page" : undefined}>히스토리</a><a href="/theme" aria-current={current === "theme" ? "page" : undefined}>테마</a></nav>;
}

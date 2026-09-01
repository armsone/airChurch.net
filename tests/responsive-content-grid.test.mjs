import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("uses complete 4-2-1 rows for sermon and praise cards",async()=>{
  const [page,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(styles,/\.sermon-grid \{[^}]*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles,/@media \(max-width:1000px\) and \(min-width:761px\) \{ \.sermon-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(styles,/\.sermon-grid\{grid-template-columns:1fr;gap:14px\}/);
  assert.match(page,/visibleSermonCount,setVisibleSermonCount\]=useState\(8\)/);
  assert.match(page,/visibleSermonCount\+4/);
  assert.match(page,/filteredPraises\.slice\(0, 4\)/);
  assert.match(page,/LoadingCards count=\{4\}/);
});

test("keeps four mobile search jump targets in a readable two-by-two grid",async()=>{
  const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(styles,/\.search-mobile-jumps\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
});

test("keeps mobile search controls and result metadata legible",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/\.search-page-hero input,\.search-page-hero select,\.search-page-hero button\{font-size:14px\}/);
  assert.match(css,/\.search-church-grid span,\.search-church-grid small,\.search-church-grid em,\.search-result-video small,\.search-result-video em\{font-size:11px\}/);
});

import { readFileSync, writeFileSync } from "node:fs";

// The authored public report is the source of truth; never inject database HTML.
const html = readFileSync(new URL("../../public/making/religion-services-report.html", import.meta.url), "utf8");
const chunks = [...html.matchAll(/<h2 id="section-(\d+)">([\s\S]*?)(?=<h2 |<\/main>)/g)];
const sections = Object.fromEntries(chunks.map(([markup, id]) => [id, markup.replaceAll("에이처치", "에어처치")]));
writeFileSync(new URL("../../app/making/research-sections.json", import.meta.url), JSON.stringify(sections, null, 2) + "\n");
console.log(`Preserved ${chunks.length} report sections, ${[...html.matchAll(/<li id="source-/g)].length} sources.`);

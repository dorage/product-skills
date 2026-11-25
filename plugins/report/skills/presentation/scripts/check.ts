// 발표 자료 검사: 쪽 수, 쪽 크기, 색 개수, 쪽별 하이라이트 개수, 넣지 않을 말
// 사용: npx tsx check.ts <자료.html> <자료.pdf> [--ban 말1,말2] [--max-hl 3]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const files = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const [htmlPath, pdfPath] = files;
if (!htmlPath || !pdfPath) {
  console.error("사용: check.ts <자료.html> <자료.pdf> [--ban 말1,말2] [--max-hl 3]");
  process.exit(2);
}
const ban = (opt("--ban") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const maxHl = Number(opt("--max-hl") ?? 3);

const html = readFileSync(htmlPath, "utf8");
const fails: string[] = [];
const strip = (s: string) => s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// 색: 16진수 색 값은 3개 이하, rgb()/rgba() 는 그 3개 중 하나를 옅게 한 것만 허용
const hex = [...new Set((html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase()))];
const rgbs = [...new Set(html.match(/rgba?\([^)]*\)/g) ?? [])];
const toHex = (c: string) =>
  "#" + c.replace(/rgba?\(|\)/g, "").split(",").slice(0, 3)
    .map((n) => Number(n.trim()).toString(16).padStart(2, "0")).join("").toUpperCase();
const strayRgb = rgbs.filter((c) => !hex.includes(toHex(c)));
console.log(`색: ${hex.join(" ")}${rgbs.length ? ` (옅게 쓴 값 ${rgbs.join(" ")})` : ""}`);
if (hex.length > 3) fails.push(`색이 ${hex.length}가지다 (3가지까지)`);
if (strayRgb.length) fails.push(`세 가지 색에 없는 색: ${strayRgb.join(" ")}`);

// 쪽별 하이라이트
const sections = html.split(/<section\b/).slice(1);
const hlRe = /<(\w+)[^>]*class="[^"]*\bhl\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g;
console.log("\n하이라이트만 읽기");
const counts: number[] = [];
sections.forEach((sec, i) => {
  const found = [...sec.matchAll(hlRe)].map((m) => strip(m[2]));
  counts.push(found.length);
  found.forEach((t) => console.log(`  ${i + 1}쪽  ${t}`));
  if (found.length > maxHl) fails.push(`${i + 1}쪽 하이라이트가 ${found.length}문장이다 (${maxHl}문장까지)`);
  if (found.length === 0) fails.push(`${i + 1}쪽에 하이라이트가 없다`);
});
console.log(`\n쪽별 하이라이트 개수: ${counts.map((c, i) => `${i + 1}:${c}`).join(" ")}`);

// PDF 쪽 수와 크기
const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
const size = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
const ratio = size ? Number(size[1]) / Number(size[2]) : 0;
console.log(`쪽 수: ${pages} (HTML 쪽 ${sections.length}) · 쪽 크기: ${size?.[1]} x ${size?.[2]}`);
if (pages !== sections.length) fails.push(`PDF ${pages}쪽, HTML ${sections.length}쪽. 글이 넘쳤는지 본다`);
if (Math.abs(ratio - 16 / 9) > 0.01) fails.push("쪽 크기가 16:9 가 아니다");

// 넣지 않을 말
if (ban.length) {
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  const hits = ban.map((w) => [w, text.split(w).length - 1] as const);
  console.log(`넣지 않을 말: ${hits.map(([w, n]) => `${w} ${n}건`).join(", ")}`);
  hits.filter(([, n]) => n > 0).forEach(([w, n]) => fails.push(`"${w}" 가 ${n}건 있다`));
}

if (fails.length) {
  console.log("\n어긋난 곳");
  fails.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("\n모두 통과");

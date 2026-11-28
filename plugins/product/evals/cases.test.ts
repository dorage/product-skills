// case.yaml 이 규칙대로 쓰였는지, 골든 문서가 그 regex 규칙을 스스로 통과하는지 본다.
// YAML 라이브러리를 쓰지 않으려고, 이 폴더 case.yaml 의 고정된 모양(2칸 들여쓴 "- type:" 블록)만 읽는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listCases } from "./run.ts";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const pluginDir = dirname(evalsDir);
const golden = (f: string) => readFileSync(join(evalsDir, "_fixtures", f), "utf8");

type Grader = Record<string, string>;

function unquote(v: string): string {
  const t = v.trim();
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

function parseGraders(yaml: string): Grader[] {
  const out: Grader[] = [];
  let cur: Grader | null = null;
  let inGraders = false;
  for (const line of yaml.split("\n")) {
    if (/^graders:\s*$/.test(line)) {
      inGraders = true;
      continue;
    }
    if (inGraders && /^\S/.test(line)) inGraders = false;
    if (!inGraders) continue;
    const start = /^  - type: (\S+)\s*$/.exec(line);
    if (start) {
      cur = { type: start[1] };
      out.push(cur);
      continue;
    }
    const kv = /^    (\w+): (.*)$/.exec(line);
    if (cur && kv) cur[kv[1]] = unquote(kv[2]);
  }
  return out;
}

const cases = [...listCases(evalsDir).values()];

function graderSet(skill: string): Grader[] {
  const info = cases.find((c) => c.skill === skill);
  assert.ok(info, `${skill} case 가 없습니다`);
  return parseGraders(readFileSync(join(info.dir, "case.yaml"), "utf8"));
}

/** 하나의 regex 채점기를 글에 대 본다. claude plugin eval 과 같이 count 는 g 를 붙여 센다 */
function check(g: Grader, text: string): boolean {
  const flags = g.flags ?? "";
  const re = new RegExp(g.pattern, flags);
  const match = g.match ?? "contains";
  if (match === "contains") return re.test(text);
  if (match === "not_contains") return !re.test(text);
  const n = Number(match.slice("count:".length));
  const all = text.match(new RegExp(g.pattern, flags.includes("g") ? flags : flags + "g")) ?? [];
  return all.length === n;
}

for (const info of cases) {
  test(`${info.name}: case.yaml 모양`, () => {
    const yaml = readFileSync(join(info.dir, "case.yaml"), "utf8");
    assert.match(yaml, /^schema_version: "1"$/m);
    assert.match(yaml, /^runs: 3$/m);
    assert.ok(existsSync(join(info.dir, "scaffold.sh")), "scaffold.sh 가 없습니다");
    assert.match(yaml, new RegExp(`/product:${info.skill} `), "프롬프트가 /product:{스킬} 로 시작하지 않습니다");
    const graders = parseGraders(yaml);
    assert.ok(graders.length >= 5);
    const names = graders.map((g) => g.name);
    assert.equal(new Set(names).size, names.length, "채점기 이름이 겹칩니다");
    for (const g of graders) {
      assert.ok(g.name, "이름 없는 채점기");
      if (g.type === "regex") assert.doesNotThrow(() => new RegExp(g.pattern, g.flags ?? ""), g.name);
      if (g.type === "regex") assert.ok(g.name.startsWith("regex-"), g.name);
      if (g.type === "file_exists") assert.ok(g.name.startsWith("file-"), g.name);
      // min 을 비우면 1 로 채워져 max: 0 과 함께 늘 떨어진다
      if (g.type === "tool_used" && g.max === "0") assert.equal(g.min, "0", `${g.name}: min: 0 이 필요합니다`);
      if (g.type === "baseline") {
        const file = resolve(info.dir, g.baseline_file);
        assert.ok(existsSync(file), `${g.name}: ${g.baseline_file} 가 없습니다`);
        assert.ok(!relative(pluginDir, file).startsWith(".."), "baseline_file 이 플러그인 밖입니다");
        assert.equal(file, join(evalsDir, "baseline", "current", "traces", `${info.skill}.jsonl`));
      }
    }
    assert.ok(graders.some((g) => g.type === "tool_used" && g.tool === "AskUserQuestion" && g.arm === "both"));
    assert.equal(graders.filter((g) => g.type === "llm").length, 2);
    // 기준 trace 가 아직 없는 새 스킬 case 는 baseline 채점기를 두지 않는다. --save-baseline 뒤에 더한다
    const hasTrace = existsSync(join(evalsDir, "baseline", "current", "traces", `${info.skill}.jsonl`));
    assert.equal(graders.filter((g) => g.type === "baseline").length, hasTrace ? 1 : 0);
  });
}

test("골든 requirements.md 가 draft regex 규칙을 통과한다 (닫힌 문서라 추천안 규칙은 뺀다)", () => {
  const text = golden("requirements.md");
  for (const g of graderSet("draft").filter((g) => g.type === "regex" && g.name !== "regex-recommendation-shape")) {
    assert.ok(check(g, text), `${g.name} 실패`);
  }
});

test("draft 추천안 규칙이 열린 결정 모양을 잡는다", () => {
  const g = graderSet("draft").find((g) => g.name === "regex-recommendation-shape")!;
  assert.ok(check(g, "    - 추천안: @초안 a안 — 잔마다 세면 계산이 쉽다"));
  assert.ok(check(g, "    - @미정 — 분담 비율은 계약 조건이다"));
  assert.ok(!check(g, golden("requirements.md")));
});

test("EARS 마커 규칙이 마커 없는 인수 조건을 잡는다", () => {
  const g = graderSet("draft").find((g) => g.name === "regex-ears-has-marker")!;
  assert.ok(!check(g, "1. WHEN 결제하면, THE System SHALL 할인한다."));
  assert.ok(check(g, "1. WHEN 결제하면, THE System SHALL 할인한다. @초안 (A1)"));
});

test("골든 requirements.md 가 persona-review regex 규칙을 통과한다", () => {
  const text = golden("requirements.md");
  for (const g of graderSet("persona-review").filter((g) => g.type === "regex")) {
    assert.ok(check(g, text), g.name);
  }
});

test("persona-review 규칙이 검토 기록이 없거나 맨 끝이 아닌 문서를 잡는다", () => {
  const gs = graderSet("persona-review");
  const log = gs.find((g) => g.name === "regex-review-log")!;
  const last = gs.find((g) => g.name === "regex-review-log-last")!;
  const text = golden("requirements.md");
  // scaffold.sh 가 지우는 것과 같은 모양: 검토 기록 절을 뺀 입력
  const staged = text.replace(/\n+## 참여자별 검토 기록\n[\s\S]*$/, "\n");
  assert.ok(!check(log, staged), "검토 기록이 없는 입력을 통과시켰습니다");
  assert.ok(!check(last, text + "\n## 덧붙인 절\n"), "검토 기록 뒤의 절을 놓쳤습니다");
});

test("draft 규칙이 persona-review 를 부르지 않은 문서를 잡는다", () => {
  const g = graderSet("draft").find((g) => g.name === "regex-persona-review-called")!;
  const text = golden("requirements.md");
  assert.ok(check(g, text));
  assert.ok(!check(g, text.replace(/## 참여자별 검토 기록/, "## 다른 절")));
});

test("골든 design.md 가 design regex 규칙을 통과한다", () => {
  const text = golden("design.md");
  for (const g of graderSet("design").filter((g) => g.type === "regex")) {
    assert.ok(check(g, text), `${g.name} 실패`);
  }
});

test("design 규칙이 -> 없는 결정 제목과 6번째 결정을 잡는다", () => {
  const gs = graderSet("design");
  const arrow = gs.find((g) => g.name === "regex-decision-has-arrow")!;
  assert.ok(!check(arrow, "- **S1. 테이블을 나눌지**\n"));
  const max = gs.find((g) => g.name === "regex-group-max-5")!;
  assert.ok(!check(max, "- *S6. 캐시를 쓴다* ->"));
});

test("brief 의 줄 수 규칙이 골든 요구사항 문서의 번호 줄·헤딩 수와 같다", () => {
  // brief 는 「참여자별 검토 기록」 절을 옮기지 않는다 (references/brief-format.md 「변환 원칙」)
  const text = golden("requirements.md").replace(/\n+## 참여자별 검토 기록\n[\s\S]*$/, "\n");
  const gs = graderSet("brief");
  assert.ok(check(gs.find((g) => g.name === "regex-numbered-count-same")!, text), "번호 줄 수가 골든 문서와 다릅니다");
  // brief 가 더하는 헤딩 (references/brief-format.md 「더하는 줄」): LLM 맥락용, 구현 전에 확인할 것, 정해진 원칙, 지금 동작, 요구사항마다 지금 동작
  const headings = (text.match(/^#{1,6} /gm) ?? []).length;
  const blocks = ["정해진 원칙", "구현 전에 확인할 것"].filter((b) => text.includes(`**${b}**`)).length;
  const now = (text.match(/^\*\*지금 동작\*\*/gm) ?? []).length;
  const added = 1 + blocks + (now > 0 ? 1 + now : 0);
  const count = gs.find((g) => g.name === "regex-heading-count")!;
  assert.equal(count.match, `count:${headings + added}`, "헤딩 수 규칙이 골든 문서와 다릅니다");
});

test("brief 규칙은 골든 요구사항 문서(마커가 있는 원본)를 떨어뜨린다", () => {
  const text = golden("requirements.md");
  const gs = graderSet("brief");
  assert.ok(!check(gs.find((g) => g.name === "regex-no-markers")!, text));
  assert.ok(!check(gs.find((g) => g.name === "regex-no-marker-column")!, text));
  // 원본은 「필요한 결정」이 맨 위이고 `---` 와 `# LLM 맥락용` 이 없어 brief 절 순서를 떨어진다
  assert.ok(!check(gs.find((g) => g.name === "regex-section-order")!, text));
  assert.ok(!check(gs.find((g) => g.name === "regex-llm-heading-once")!, text));
});

test("brief 규칙은 LLM 맥락용 블록이 앞쪽에 남은 글과 읽기 안내 줄을 잡는다", () => {
  const gs = graderSet("brief");
  const below = gs.find((g) => g.name === "regex-llm-blocks-below-line")!;
  const good = "## 요구사항\n\n---\n\n# LLM 맥락용\n\n## 지금 동작\n\n**지금 동작** (origin/main 코드)\n";
  assert.ok(check(below, good));
  assert.ok(!check(below, "## 요구사항\n\n**지금 동작** (origin/main 코드)\n\n---\n\n# LLM 맥락용\n"));
  assert.ok(!check(below, "## 결정 기록 (2026-11-02)\n\n---\n\n# LLM 맥락용\n"));
  const guide = gs.find((g) => g.name === "regex-no-reading-guide")!;
  assert.ok(check(guide, good));
  assert.ok(!check(guide, "**여기까지 사람이 읽습니다.**\n"));
});

test("bdd 규칙이 올바른 feature 를 통과시키고 태그 없는 시나리오를 잡는다", () => {
  const good = [
    "# language: ko",
    "기능: 임직원의 주문 할인",
    "",
    "  @결정",
    "  시나리오: 인증된 임직원이 라떼 2잔을 사면 3,000원이 할인된다",
    "    만약 임직원이 5,900원 라떼 2잔을 결제한다",
    "    그러면 결제 금액은 8,800원이다",
    "",
    "  @초안",
    "  시나리오 개요: 인증하지 않은 사람은 정가로 결제한다",
    "    그러면 결제 금액은 11,800원이다",
  ].join("\n");
  const bad = good.replace("  @초안\n", "");
  const gs = graderSet("bdd").filter((g) => g.type === "regex" && g.target !== "files");
  for (const g of gs) assert.ok(check(g, good), `${g.name} 이 올바른 feature 를 떨어뜨립니다`);
  const every = gs.find((g) => g.name === "regex-every-scenario-tagged")!;
  assert.ok(!check(every, bad));
  const names = graderSet("bdd").find((g) => g.name === "regex-kebab-file-names")!;
  assert.ok(check(names, "out/features/order/customer-pays-order.feature\nout/features-all.txt"));
  assert.ok(!check(names, "out/features/Customer_Pays.feature"));
});

test("draft 규칙이 요구사항 문서의 코드 경로를 잡는다", () => {
  const g = graderSet("draft").find((g) => g.name === "regex-no-code-path")!;
  const text = golden("requirements.md");
  assert.ok(check(g, text));
  assert.ok(!check(g, text + "\n- 결제는 `src/order/checkout.ts` 에서 계산한다\n"));
  assert.ok(!check(g, text + "\n- `in_house_service.py` 가 인증한다\n"));
});

test("references/flow.md 견본이 flow regex 규칙을 통과한다", () => {
  const ref = readFileSync(join(pluginDir, "references", "flow.md"), "utf8");
  const sample = /````markdown\n([\s\S]*?)\n````/.exec(ref);
  assert.ok(sample, "references/flow.md 에 견본이 없습니다");
  for (const g of graderSet("flow").filter((g) => g.type === "regex")) {
    assert.ok(check(g, sample[1]), `${g.name} 실패`);
  }
});

test("flow 결정 문자 규칙이 다른 문서의 결정 문자를 잡는다", () => {
  const g = graderSet("flow").find((g) => g.name === "regex-decision-letters")!;
  assert.ok(!check(g, "- **S1. 정산 탭을 어디에 둘지** ->"));
  assert.ok(check(g, "- **M1. 정산 탭을 어디에 둘지** ->"));
});

const headerSkills = ["draft", "design", "flow", "task", "brief"];
const headerRule = (skill: string) => graderSet(skill).find((g) => g.name === "regex-header-line")!;

test("머리말 줄 규칙이 문서를 쓰는 다섯 case 에 같은 모양으로 있다", () => {
  const patterns = headerSkills.map((s) => {
    const g = headerRule(s);
    assert.ok(g, `${s} 에 regex-header-line 이 없습니다`);
    assert.equal(g.flags, undefined, `${s}: m 을 붙이면 제목 아래가 아닌 자리도 통과합니다`);
    return g.pattern;
  });
  assert.equal(new Set(patterns).size, 1);
});

test("머리말 줄 규칙이 두 윤문 표기를 받고 틀린 줄을 잡는다 (spec-format 「문서 머리말」)", () => {
  const g = headerRule("draft");
  const doc = (line: string) => `# 제휴카페 임직원 할인 기획 초안\n\n${line}\n\n## 필요한 결정\n`;
  assert.ok(check(g, doc("2026-11-25 · @kanghyunlee · 윤문 안 함")));
  assert.ok(check(g, doc("2026-11-25 · @kanghyunlee · 윤문 humanize-korean@im-not-ai 2.4.6")));
  assert.ok(check(g, doc("2026-11-25 · @Lee Kang Hyun · 윤문 안 함")), "이름에 빈칸이 있는 저자를 떨어뜨렸습니다");
  assert.ok(!check(g, doc("2026-11-25 · @kanghyunlee")), "윤문 표기 없는 옛 줄을 통과시켰습니다");
  assert.ok(!check(g, doc("2026-11-25 · @kanghyunlee · 윤문 humanize-korean@im-not-ai")), "버전 없는 도구 표기를 통과시켰습니다");
  assert.ok(!check(g, doc("2026-11-25 · @kanghyunlee · 윤문함")));
  assert.ok(!check(g, doc("- 기준 날짜: 2026-11-25")));
  assert.ok(!check(g, "# 제목\n\n## 필요한 결정\n\n2026-11-25 · @kanghyunlee · 윤문 안 함\n"), "제목 아래가 아닌 줄을 통과시켰습니다");
});

test("윤문 도구 표기의 @ 가 마커 규칙에 걸리지 않는다", () => {
  const line = "# 제목\n\n2026-11-25 · @kanghyunlee · 윤문 humanize-korean@im-not-ai 2.4.6\n";
  assert.ok(check(graderSet("brief").find((g) => g.name === "regex-no-markers")!, line));
  assert.ok(check(graderSet("task").find((g) => g.name === "regex-no-decision-markers")!, line));
});

test("표기 바꾸는 명령(spec-format)과 덮어쓰기 전 검사(polish-keeps-content)가 머리말 줄과 부딪히지 않는다", () => {
  const spec = readFileSync(join(pluginDir, "references", "spec-format.md"), "utf8");
  const perl = /^perl -pi -e '(.+)' "\{표기\}" \{파일\}$/m.exec(spec);
  assert.ok(perl, "spec-format 에 표기 바꾸는 명령이 없습니다");
  const keep = /^keep\(\) \{\n[\s\S]*?\n\}$/m.exec(readFileSync(join(pluginDir, "principles", "polish-keeps-content.md"), "utf8"));
  assert.ok(keep, "polish-keeps-content 에 keep() 이 없습니다");
  const dir = mkdtempSync(join(tmpdir(), "header-"));
  const mark = (file: string, m: string) => execFileSync("perl", ["-pi", "-e", perl[1], m, file]);
  const first = (file: string) => readFileSync(file, "utf8").split("\n")[2];
  const same = (a: string, b: string) =>
    execFileSync("bash", ["-c", `${keep[0]}\ndiff <(keep "$1") <(keep "$2") >/dev/null && echo SAME || echo DIFF`, "bash", a, b], { encoding: "utf8" }).trim();
  try {
    // 윤문 전 원본과 윤문본은 둘 다 `윤문 안 함` 이라 SAME, 덮어쓴 뒤 표기를 바꾼다
    const before = join(dir, "before.md");
    const after = join(dir, "after.md");
    writeFileSync(before, golden("requirements.md"));
    writeFileSync(after, golden("requirements.md"));
    assert.equal(same(before, after), "SAME");
    mark(after, "humanize-korean@im-not-ai 2.4.6");
    assert.equal(first(after), "2026-11-02 · @마스터 · 윤문 humanize-korean@im-not-ai 2.4.6");
    // 표기를 덮어쓰기 전에 바꿨다면 버전 숫자 때문에 DIFF 가 된다. 그래서 순서를 지킨다
    assert.equal(same(before, after), "DIFF");
    // 다시 고쳐 쓸 때 되돌린다. 머리말 줄 말고는 바뀌지 않는다
    mark(after, "안 함");
    assert.equal(readFileSync(after, "utf8"), golden("requirements.md"));
    // 윤문 표기가 없는 옛 줄에는 붙고, 머리말 줄이 없는 옛 문서는 그대로다
    const old = join(dir, "old.md");
    writeFileSync(old, "# 제목\n\n2026-11-02 · @Lee Kang Hyun\n\n본문 2026-11-03 · @다른줄\n");
    mark(old, "안 함");
    assert.equal(readFileSync(old, "utf8"), "# 제목\n\n2026-11-02 · @Lee Kang Hyun · 윤문 안 함\n\n본문 2026-11-03 · @다른줄\n");
    const bullets = "# 제목\n\n- 기준 날짜: 2026-11-02\n";
    writeFileSync(old, bullets);
    mark(old, "안 함");
    assert.equal(readFileSync(old, "utf8"), bullets);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

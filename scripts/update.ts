// product-skills 가 내놓는 것을 한 번에 최신으로 올린다.
//
//   npx tsx scripts/update.ts            마켓플레이스 → 플러그인(스킬 포함) → product CLI 순서로 올린다
//   npx tsx scripts/update.ts --dry-run  바꾸지 않고 무엇을 올릴지만 보여 준다
//
// 스킬은 플러그인 안에 들어 있어서 플러그인을 올리면 함께 올라간다.
// 한 단계가 실패해도 나머지는 진행하고, 실패가 하나라도 있으면 종료 코드 1 로 끝난다.
// node 기본 모듈만 쓴다. 리포를 받지 않고 이 파일 하나만 내려받아 실행해도 되게 하려는 것이다.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MARKETPLACE = "product-skills";
const MARKETPLACE_REPO = "dorage/product-skills";
const CLI_PACKAGE = "@dorage/product";
const CLI_COMMAND = "product";

const dryRun = process.argv.includes("--dry-run");
const onWindows = process.platform === "win32";

type Result = { code: number; out: string; err: string };

type Marketplace = { name: string; source: string };

type Installed = {
  id: string;
  version: string;
  scope: string;
  installPath?: string;
  readFromFolder?: string;
  projectPath?: string;
};

type UpdateLine = {
  outcome?: string;
  updateOutcome?: string;
  oldVersion?: string;
  newVersion?: string;
  message?: string;
};

let failures = 0;
let changed = 0;

// 표준 입력을 닫아 둔다. 명령이 무언가를 물으며 멈추지 않고 바로 실패하게 하려는 것이다
function run(command: string, args: string[], cwd?: string): Result {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: onWindows });
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const has = (command: string): boolean => run(onWindows ? "where" : "which", [command]).code === 0;

const lastLine = (text: string): string => text.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";

function readJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const ok = (line: string) => console.log(`  ✔ ${line}`);
const same = (line: string) => console.log(`  · ${line}`);
const skip = (line: string) => console.log(`  - ${line}`);
const fail = (line: string) => {
  failures++;
  console.log(`  ✘ ${line}`);
};

function installedPlugins(): Installed[] {
  const all = readJson<Installed[]>(run("claude", ["plugin", "list", "--json"]).out) ?? [];
  return all.filter((p) => p.id.endsWith(`@${MARKETPLACE}`));
}

// 플러그인 폴더의 스킬 수. 폴더 마켓플레이스는 캐시가 아니라 그 자리의 폴더를 읽는다
function skillCount(p: Installed): number | null {
  const root = p.readFromFolder ?? p.installPath;
  if (!root || !existsSync(join(root, "skills"))) return null;
  return readdirSync(join(root, "skills")).filter((name) => existsSync(join(root, "skills", name, "SKILL.md"))).length;
}

// 같은 플러그인이 범위(user·project·local)와 리포마다 따로 설치될 수 있어서 설치 하나를 가리키는 이름
function label(p: Installed): string {
  const name = p.id.slice(0, -`@${MARKETPLACE}`.length);
  return p.projectPath ? `${name} (${p.scope}, ${p.projectPath})` : `${name} (${p.scope})`;
}

function updateMarketplace(): boolean {
  console.log("마켓플레이스");
  const list = readJson<Marketplace[]>(run("claude", ["plugin", "marketplace", "list", "--json"]).out);
  if (!list) {
    fail("마켓플레이스 목록을 읽지 못했다");
    return false;
  }
  if (!list.some((m) => m.name === MARKETPLACE)) {
    skip(`${MARKETPLACE} 가 등록되어 있지 않다. 설치: claude plugin marketplace add ${MARKETPLACE_REPO}`);
    return false;
  }
  if (dryRun) {
    same(`${MARKETPLACE} 를 최신 목록으로 받을 차례`);
    return true;
  }
  const r = run("claude", ["plugin", "marketplace", "update", MARKETPLACE]);
  if (r.code !== 0) {
    fail(`${MARKETPLACE} 갱신 실패: ${lastLine(r.err || r.out)}`);
    return true;
  }
  ok(`${MARKETPLACE} 목록을 최신으로 받았다`);
  return true;
}

function updatePlugins(): void {
  console.log("플러그인 (스킬은 플러그인 안에 있어 함께 올라간다)");
  const plugins = installedPlugins();
  if (plugins.length === 0) {
    skip(`설치된 플러그인이 없다. 설치: claude plugin install product@${MARKETPLACE}`);
    return;
  }
  for (const p of plugins) {
    // project·local 범위는 설치한 리포 폴더에서 불러야 그 설치가 올라간다
    if (p.projectPath && !existsSync(p.projectPath)) {
      skip(`${label(p)} 설치한 폴더가 없어져서 건너뛴다`);
      continue;
    }
    if (dryRun) {
      same(`${label(p)} 지금 ${p.version}`);
      continue;
    }
    const r = run("claude", ["plugin", "update", p.id, "--scope", p.scope, "--json", "--yes"], p.projectPath);
    const line = readJson<UpdateLine>(r.out.split("\n")[0] ?? "");
    if (r.code !== 0 || line?.outcome !== "ok") {
      fail(`${label(p)} 실패: ${line?.message ?? lastLine(r.err || r.out)}`);
      continue;
    }
    const after = installedPlugins().find((x) => x.id === p.id && x.scope === p.scope && x.projectPath === p.projectPath);
    const count = skillCount(after ?? p);
    const skills = count === null ? "" : ` · 스킬 ${count}개`;
    if (line.updateOutcome === "updated") {
      changed++;
      ok(`${label(p)} ${line.oldVersion} → ${line.newVersion}${skills}`);
    } else {
      same(`${label(p)} ${line.newVersion ?? p.version} 이미 최신${skills}`);
    }
  }
}

function updateCli(): void {
  console.log("CLI");
  if (!has("npm")) {
    skip(`npm 이 없어서 ${CLI_PACKAGE} 를 건너뛴다. node 를 설치한 뒤 다시 실행한다`);
    return;
  }
  const latest = run("npm", ["view", CLI_PACKAGE, "version"]);
  if (latest.code !== 0 || !latest.out) {
    fail(`${CLI_PACKAGE} 최신 버전을 npm 에서 읽지 못했다: ${lastLine(latest.err)}`);
    return;
  }
  const want = lastLine(latest.out);
  const before = has(CLI_COMMAND) ? run(CLI_COMMAND, ["--version"]).out : "";
  // 버전 글자를 직접 비교하지 않고 CLI 에 묻는다. 0.10.0 이 0.9.0 보다 작게 나오기 때문이다
  if (before && run(CLI_COMMAND, ["--version", "--expect", want]).code === 0) {
    same(`${CLI_PACKAGE} ${before} 이미 최신`);
    return;
  }
  if (dryRun) {
    same(`${CLI_PACKAGE} ${before || "없음"} → ${want} 로 올릴 차례`);
    return;
  }
  const r = run("npm", ["i", "-g", `${CLI_PACKAGE}@${want}`]);
  if (r.code !== 0) {
    fail(`${CLI_PACKAGE} 설치 실패: ${lastLine(r.err)}. 직접 실행: npm i -g ${CLI_PACKAGE}@${want}`);
    return;
  }
  changed++;
  ok(`${CLI_PACKAGE} ${before || "없음"} → ${run(CLI_COMMAND, ["--version"]).out || want}`);
}

function main(): void {
  if (has("claude")) {
    if (updateMarketplace()) updatePlugins();
  } else {
    console.log("플러그인");
    fail("claude 명령이 없어서 플러그인을 올리지 못했다");
  }
  updateCli();

  console.log("");
  if (dryRun) console.log("--dry-run 이라 아무것도 바꾸지 않았다.");
  else if (failures > 0) console.log(`실패 ${failures}건. 위 ✘ 줄을 확인한다.`);
  else if (changed > 0) console.log("모두 최신이다. 새 세션을 열어야 올린 플러그인이 적용된다.");
  else console.log("모두 이미 최신이다.");
  process.exit(failures > 0 ? 1 : 0);
}

main();

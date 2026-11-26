// 진행 보고 자료 모으기: 리포마다 범위 안 커밋, 같은 제목을 뺀 수, 커밋이 든 원격 브랜치, 브랜치의 PR
// 사용:
//   기간: npx tsx collect.ts <리포 또는 리포들이 든 폴더>... --since 2026-11-23 [--until 2026-11-27] [--author 이름|이름2]
//   기능: npx tsx collect.ts <리포>... --range origin/main..origin/feat/x [--author ...]
// 옵션: --no-fetch (git fetch 생략), --no-pr (gh 로 PR 찾기 생략)
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const valued = new Set(["--since", "--until", "--author", "--range"]);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(name);
const paths = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
const since = opt("--since");
const until = opt("--until");
const author = opt("--author");
const range = opt("--range");
if (!paths.length || (!since && !range)) {
  console.error("사용: collect.ts <리포|폴더>... (--since 날짜 [--until 날짜] | --range A..B) [--author 이름|이름2] [--no-fetch] [--no-pr]");
  process.exit(2);
}

const run = (cwd: string, cmd: string, a: string[]) => {
  try {
    return execFileSync(cmd, a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
const isRepo = (p: string) => existsSync(join(p, ".git"));

// 폴더를 주면 바로 아래 리포들을 쓴다. repos/ 가 있으면(product 외부 셋업) 그 안을 쓴다
const repos = paths.flatMap((p) => {
  let abs = resolve(p);
  if (existsSync(join(abs, "repos")) && statSync(join(abs, "repos")).isDirectory()) abs = join(abs, "repos");
  else if (isRepo(abs)) return [abs];
  return readdirSync(abs)
    .map((n) => join(abs, n))
    .filter((d) => statSync(d).isDirectory() && isRepo(d));
});

const scope = range ? `범위 ${range}` : `기간 ${since} ~ ${until ?? "지금"}`;
console.log(`# 진행 보고 자료 (${scope}${author ? `, 작성자 ${author}` : ""})\n`);

let totalAll = 0;
let totalUnique = 0;
for (const repo of repos) {
  if (!flag("--no-fetch")) run(repo, "git", ["fetch", "-q", "--all"]);
  const logArgs = ["log", "--no-merges", "--date=format:%m-%d", "--pretty=%h%x09%ad%x09%an%x09%s"];
  if (range) logArgs.push(range);
  else logArgs.push("--all", `--since=${since} 00:00`);
  if (until) logArgs.push(`--until=${until} 23:59`);
  if (author) logArgs.push(`--author=${author.replace(/\|/g, "\\|")}`);
  const lines = run(repo, "git", logArgs).split("\n").filter(Boolean);
  if (!lines.length) continue;

  const commits = lines.map((l) => {
    const [sha, date, name, subject] = l.split("\t");
    return { sha, date, name, subject };
  });
  const unique = new Set(commits.map((c) => c.subject)).size;
  totalAll += commits.length;
  totalUnique += unique;

  // 커밋이 든 원격 브랜치 (main/master/HEAD 제외)
  const branches = new Set<string>();
  for (const c of commits) {
    run(repo, "git", ["branch", "-r", "--contains", c.sha])
      .split("\n")
      .map((b) => b.trim().replace(/^origin\//, ""))
      .filter((b) => b && !b.includes("->") && !/^(main|master|HEAD|develop|dev|stag|staging|production|prod)$|^release\//.test(b))
      .forEach((b) => branches.add(b));
  }

  console.log(`## ${repo.split("/").pop()}\n`);
  console.log(`- 커밋 ${commits.length}건, 같은 제목을 뺀 수 ${unique}건`);
  console.log(`- 날짜별: ${Object.entries(commits.reduce<Record<string, number>>((m, c) => ((m[c.date] = (m[c.date] ?? 0) + 1), m), {})).map(([d, n]) => `${d} ${n}`).join(", ")}`);
  console.log("\n### 커밋\n");
  commits.forEach((c) => console.log(`- ${c.sha} ${c.date} ${c.subject}`));

  const prQ = '.[] | "#\\(.number) \\(.state) \\(.title)"';
  const found = new Set<string>();
  if (branches.size) {
    console.log("\n### 커밋이 든 브랜치와 PR\n");
    for (const b of branches) {
      const pr = flag("--no-pr") ? "" : run(repo, "gh", ["pr", "list", "--head", b, "--state", "all", "--json", "number,title,state", "-q", prQ]);
      pr.split("\n").filter(Boolean).forEach((l) => found.add(l.split(" ")[0]));
      console.log(`- ${b}${pr ? ` → ${pr.split("\n").join(" / ")}` : ""}`);
    }
  }

  // 브랜치가 지워졌거나 squash 머지된 PR: 커밋 SHA 로 PR 을 찾는다 (같은 제목은 한 번만, 최대 40건)
  if (!flag("--no-pr")) {
    const extra = new Map<string, string>();
    const seen = new Set<string>();
    for (const c of commits) {
      if (seen.has(c.subject) || seen.size >= 40) continue;
      seen.add(c.subject);
      run(repo, "gh", ["pr", "list", "--search", c.sha, "--state", "all", "--json", "number,title,state", "-q", prQ])
        .split("\n").filter(Boolean)
        .forEach((l) => { const n = l.split(" ")[0]; if (!found.has(n)) extra.set(n, l); });
    }
    if (extra.size) {
      console.log("\n### 커밋 SHA 로 찾은 PR (브랜치로 못 찾은 것)\n");
      extra.forEach((l) => console.log(`- ${l}`));
    }
  }
  console.log("");
}

console.log(`## 합계\n\n- 리포 ${repos.length}개 중 커밋이 있는 곳의 커밋 ${totalAll}건, 같은 제목을 뺀 수 ${totalUnique}건`);
console.log("- 커밋 수와 날짜별 건수는 자료 확인용이다. 보고서의 지표로 쓰지 않는다 (progress-not-activity.md)");

import { existsSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ancestorOf, gitState, productHere } from "./inspect.js";
import { git } from "./git.js";
import { repoName } from "./repoName.js";
import {
  alreadyResult,
  COMMIT_MESSAGE,
  createProductDir,
  GITIGNORE_FILE,
  lastLine,
  q,
  type SetupResult,
  settingsOnly,
  type Skipped,
} from "./scaffold.js";
import { SETTINGS_FILE, writeSettings } from "./settings.js";

export interface ExternalOptions {
  repos: string[];
  useExistingRepo: boolean;
  allowNested: boolean;
}

const addCmd = (url: string, name: string) => `git submodule add ${q(url)} repos/${q(name)}`;

// 지금 폴더를 product 루트로 만들고 리포를 repos/ 아래 submodule 로 더한다 (요구사항 2)
export function setupExternal(cwd: string, opts: ExternalOptions): SetupResult {
  const here = productHere(cwd);
  if (here) return alreadyResult(here) ?? settingsOnly(cwd, "external");

  const g = gitState(cwd);
  if (g.inside && !g.isTop) {
    // E5
    return {
      status: "stopped",
      mode: "external",
      productDir: null,
      reason: `${cwd} 는 다른 git 리포(${g.top})의 하위 폴더라 외부 셋업을 멈췄다. 리포 밖 폴더에서 다시 부른다`,
      next: [],
    };
  }

  // 답이 더 필요한 것을 한 번에 모은다 (E6, E3)
  const need: string[] = [];
  const extra: Record<string, unknown> = {};
  const reasons: string[] = [];
  if (g.inside && g.hasCommits && !opts.useExistingRepo) {
    need.push("use-existing-repo");
    reasons.push(`${cwd} 는 커밋이 있는 리포다. 이 리포를 product 루트로 써도 되는지 정한다`);
  }
  const ancestor = ancestorOf(cwd);
  if (ancestor && !opts.allowNested) {
    need.push("allow-nested");
    extra.ancestor = ancestor;
    reasons.push(`위쪽에 product 폴더 ${ancestor} 가 있다. 그래도 여기에 셋업할지 정한다`);
  }
  if (need.length > 0) {
    const flags = [
      ...opts.repos.map((r) => `--repo ${q(r)}`),
      ...(opts.useExistingRepo || need.includes("use-existing-repo") ? ["--use-existing-repo"] : []),
      ...(opts.allowNested || need.includes("allow-nested") ? ["--allow-nested"] : []),
    ];
    return {
      status: "need",
      mode: "external",
      productDir: null,
      reason: reasons.join(" / "),
      need,
      ...extra,
      next: [`product setup --mode external ${flags.join(" ")}`],
    };
  }

  // E4
  if (!g.inside) {
    const init = git(["init", "-q"], cwd);
    if (init.code !== 0) {
      return {
        status: "error",
        mode: "external",
        productDir: null,
        reason: lastLine(init.stderr) || "git init 이 실패했다",
        next: ["git init"],
      };
    }
  }

  const gitDir = git(["rev-parse", "--absolute-git-dir"], cwd).stdout.trim();
  const added: { url: string; name: string }[] = [];
  const skipped: Skipped[] = [];
  const seen = new Set<string>();
  for (const url of opts.repos) {
    const name = repoName(url);
    if (!name) {
      skipped.push({ url, name, reason: "주소에서 리포 이름을 읽을 수 없다" });
      continue;
    }
    if (seen.has(name)) {
      // E8
      skipped.push({ url, name, reason: `repos/${name} 이름이 앞 주소와 겹친다` });
      continue;
    }
    seen.add(name);
    const path = join(cwd, "repos", name);
    const modules = join(gitDir, "modules", "repos", name);
    const existed = { path: existsSync(path), modules: existsSync(modules) };
    const r = git(["submodule", "add", "-q", url, `repos/${name}`], cwd);
    if (r.code === 0) {
      added.push({ url, name });
      continue;
    }
    // E7. 이번 실행이 만든 흔적만 지운다
    if (!existed.path && existsSync(path)) rmSync(path, { recursive: true, force: true });
    if (!existed.modules && isAbsolute(modules) && existsSync(modules)) {
      rmSync(modules, { recursive: true, force: true });
    }
    skipped.push({ url, name, reason: lastLine(r.stderr) || "git submodule add 가 실패했다" });
  }

  const productDir = createProductDir(cwd);
  writeSettings(cwd, "external");

  // F1: 커밋은 사용자가 한다. 있는 경로만 담는다 (리포가 0개면 .gitmodules 가 없다)
  const paths = [GITIGNORE_FILE, SETTINGS_FILE];
  const next = [
    ...skipped.map((s) => addCmd(s.url, s.name || "<이름>")),
    `git add ${paths.join(" ")} && git commit -m ${q(COMMIT_MESSAGE)}`,
    ...added.map((a) => `앞으로 개발은 repos/${a.name}/ 에서 한다`),
  ];
  return { status: "done", mode: "external", productDir, added, skipped, next };
}

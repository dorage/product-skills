import { ancestorOf, gitState, productHere } from "./inspect.js";
import { git } from "./git.js";
import {
  alreadyResult,
  COMMIT_MESSAGE,
  createProductDir,
  GITIGNORE_FILE,
  inDir,
  lastLine,
  q,
  type SetupResult,
  settingsOnly,
} from "./scaffold.js";
import { SETTINGS_FILE, writeSettings } from "./settings.js";

export interface InternalOptions {
  at?: "top" | "here";
  allowNested: boolean;
}

const FILES = [GITIGNORE_FILE, SETTINGS_FILE];

// 리포 안에 .product/ 를 만들고 두 파일만 담은 커밋 1개를 만든다 (요구사항 3)
export function setupInternal(cwd: string, opts: InternalOptions): SetupResult {
  const g = gitState(cwd);
  if (!g.inside) {
    // E12
    return {
      status: "stopped",
      mode: "internal",
      productDir: null,
      reason: `${cwd} 는 git 리포 안이 아니라 내부 셋업을 멈췄다. 리포 밖에서는 외부 셋업을 쓴다`,
      next: ["product setup --mode external --repo <리포 주소>"],
    };
  }
  let target: string;
  if (g.isTop || opts.at === "here") target = cwd;
  else if (opts.at === "top" && g.top) target = g.top;
  else {
    // E11
    return {
      status: "need",
      mode: "internal",
      productDir: null,
      reason: `지금 폴더가 리포 맨 위(${g.top})가 아니다. 리포 맨 위와 지금 폴더 중 어디에 .product/ 를 만들지 정한다`,
      need: ["at"],
      top: g.top,
      next: ["product setup --mode internal --at top", "product setup --mode internal --at here"],
    };
  }

  const here = productHere(target);
  if (here) return alreadyResult(here) ?? settingsOnly(target, "internal", cwd);

  const ancestor = ancestorOf(target);
  if (ancestor && !opts.allowNested) {
    // E3
    return {
      status: "need",
      mode: "internal",
      productDir: null,
      reason: `위쪽에 product 폴더 ${ancestor} 가 있다. 그래도 여기에 셋업할지 정한다`,
      need: ["allow-nested"],
      ancestor,
      next: [`product setup --mode internal${opts.at ? ` --at ${opts.at}` : ""} --allow-nested`],
    };
  }

  const productDir = createProductDir(target);
  writeSettings(target, "internal");

  // U3: 두 파일을 경로로 지정해 커밋해서 미리 올려 둔 다른 변경을 섞지 않는다
  const commitCmd = inDir(
    target,
    cwd,
    `git add ${FILES.join(" ")} && git commit -m ${q(COMMIT_MESSAGE)} -- ${FILES.join(" ")}`,
  );
  const failed = (stderr: string): SetupResult => ({
    // E13. 파일은 남기고 --no-verify 로 우회하지 않는다
    status: "commitFailed",
    mode: "internal",
    productDir,
    commit: null,
    reason: lastLine(stderr) || "git commit 이 실패했다",
    next: [commitCmd],
  });
  const add = git(["add", "--", ...FILES], target);
  if (add.code !== 0) return failed(add.stderr);
  const commit = git(["commit", "-q", "-m", COMMIT_MESSAGE, "--", ...FILES], target);
  if (commit.code !== 0) return failed(commit.stderr || commit.stdout);

  const hash = git(["rev-parse", "HEAD"], target).stdout.trim();
  const branch = git(["symbolic-ref", "--short", "-q", "HEAD"], target).stdout.trim() || "HEAD";
  return {
    status: "done",
    mode: "internal",
    productDir,
    commit: hash,
    next: [inDir(target, cwd, `git push origin ${q(branch)}`)],
  };
}

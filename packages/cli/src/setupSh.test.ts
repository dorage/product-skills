import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./cli.js";
import { at, bareRepo, listFiles, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

// T6·T7 통합 사례를 CLI 와 setup.sh 에 똑같이 돌려, 같은 파일과 같은 상태 줄을 내는지 본다 (U1)
const home = useTestEnv();

const SETUP_SH = fileURLToPath(new URL("../../../plugins/product/skills/setup/setup.sh", import.meta.url));

const remotes = tmp("product-remotes-");
const api = bareRepo(remotes, "cafe-api");
const web = bareRepo(remotes, "cafe-web");
const other = bareRepo(at(remotes, "other"), "cafe-api");
const missing = "file:///없는/폴더/cafe-gone.git";
// HEAD 가 아직 없는 브랜치를 가리키는 리포. git 이 받다가 실패하면서 repos/ 와 .git/modules/ 에 흔적을 남긴다
const unborn = bareRepo(remotes, "cafe-unborn");
sh(unborn, "symbolic-ref", "HEAD", "refs/heads/none");

// CLI status → setup.sh 상태 줄
const STATUS: Record<string, string> = {
  done: "DONE",
  already: "ALREADY",
  stopped: "STOPPED",
  commitFailed: "COMMIT_FAILED",
};

interface Case {
  name: string;
  // 임시 폴더 하나에 사례 폴더를 만들고 셋업을 부를 폴더와 결과를 볼 폴더를 돌려준다
  fixture(base: string): { cwd: string; root: string };
  cli: string[];
  sh: string[];
  status: string;
  check?: (root: string) => void;
}

const pending = (dir: string) => {
  writeFileSync(join(dir, "other.txt"), "staged\n");
  sh(dir, "add", "other.txt");
};

const CASES: Case[] = [
  {
    name: "내부 셋업, 리포 맨 위 (미리 올려 둔 변경 있음)",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      pending(d);
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "internal"],
    sh: ["internal", "top"],
    status: "DONE",
  },
  {
    name: "내부 셋업, 하위 폴더에 (here)",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      return { cwd: at(d, "packages/api"), root: d };
    },
    cli: ["setup", "--mode", "internal", "--at", "here"],
    sh: ["internal", "here"],
    status: "DONE",
  },
  {
    name: "내부 셋업, 하위 폴더에서 리포 맨 위에 (top)",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      return { cwd: at(d, "packages/api"), root: d };
    },
    cli: ["setup", "--mode", "internal", "--at", "top"],
    sh: ["internal", "top"],
    status: "DONE",
  },
  {
    name: "내부 셋업, 커밋 없는 리포",
    fixture: (b) => {
      const d = at(b, "shop");
      sh(d, "init", "-q", "-b", "main");
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "internal"],
    sh: ["internal", "top"],
    status: "DONE",
  },
  {
    name: "E12 내부 셋업, git 리포 밖",
    fixture: (b) => ({ cwd: at(b, "shop"), root: join(b, "shop") }),
    cli: ["setup", "--mode", "internal"],
    sh: ["internal", "top"],
    status: "STOPPED",
  },
  {
    name: "E13 내부 셋업, 커밋 실패",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      const hook = join(d, ".git/hooks/pre-commit");
      writeFileSync(hook, "#!/bin/sh\necho '훅이 막았다' >&2\nexit 1\n");
      chmodSync(hook, 0o755);
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "internal"],
    sh: ["internal", "top"],
    status: "COMMIT_FAILED",
  },
  {
    name: "E1 내부 셋업, 이미 셋업함",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      mkdirSync(join(d, ".product"));
      writeFileSync(join(d, ".product-settings"), "mode: internal\nroot: .\ntemplates: {}\n");
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "internal"],
    sh: ["internal", "top"],
    status: "ALREADY",
  },
  {
    name: "E2 설정 파일만 만들기",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      mkdirSync(join(d, ".product"));
      return { cwd: d, root: d };
    },
    cli: ["setup", "--settings-only", "--mode", "internal"],
    sh: ["settings-only", "internal"],
    status: "DONE",
  },
  {
    name: "외부 셋업, 빈 폴더에 리포 2개",
    fixture: (b) => ({ cwd: at(b, "cafe"), root: join(b, "cafe") }),
    cli: ["setup", "--mode", "external", "--repo", api, "--repo", web],
    sh: ["external", api, web],
    status: "DONE",
  },
  {
    name: "E7·E8 외부 셋업, 받지 못한 리포와 겹친 이름",
    fixture: (b) => ({ cwd: at(b, "cafe"), root: join(b, "cafe") }),
    cli: ["setup", "--mode", "external", "--repo", api, "--repo", missing, "--repo", other],
    sh: ["external", api, missing, other],
    status: "DONE",
  },
  {
    name: "E7 외부 셋업, 흔적을 남기는 실패는 이번 실행이 만든 흔적만 지운다",
    fixture: (b) => ({ cwd: at(b, "cafe"), root: join(b, "cafe") }),
    cli: ["setup", "--mode", "external", "--repo", unborn, "--repo", api],
    sh: ["external", unborn, api],
    status: "DONE",
    check: (root) => {
      assert.equal(existsSync(join(root, "repos/cafe-unborn")), false);
      assert.equal(existsSync(join(root, ".git/modules/repos/cafe-unborn")), false);
      assert.ok(existsSync(join(root, "repos/cafe-api/.git")));
    },
  },
  {
    name: "E9 외부 셋업, 받은 리포 0개",
    fixture: (b) => ({ cwd: at(b, "cafe"), root: join(b, "cafe") }),
    cli: ["setup", "--mode", "external", "--repo", missing],
    sh: ["external", missing],
    status: "DONE",
  },
  {
    name: "외부 셋업, 커밋이 있는 리포를 루트로 (스킬이 이미 물음)",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "cafe"));
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "external", "--repo", api, "--use-existing-repo"],
    sh: ["external", api],
    status: "DONE",
  },
  {
    name: "E5 외부 셋업, 다른 리포의 하위 폴더",
    fixture: (b) => {
      const d = repoWithCommit(join(b, "shop"));
      return { cwd: at(d, "docs"), root: d };
    },
    cli: ["setup", "--mode", "external", "--repo", api],
    sh: ["external", api],
    status: "STOPPED",
  },
  {
    name: "E1 외부 셋업, 이미 셋업함",
    fixture: (b) => {
      const d = at(b, "cafe");
      mkdirSync(join(d, ".product"));
      writeFileSync(join(d, ".product-settings"), "mode: external\nroot: .\ntemplates: {}\n");
      return { cwd: d, root: d };
    },
    cli: ["setup", "--mode", "external", "--repo", api],
    sh: ["external", api],
    status: "ALREADY",
  },
];

const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const tryGit = (dir: string, ...args: string[]) => {
  try {
    return sh(dir, ...args);
  } catch {
    return null;
  }
};

// 결과 폴더에서 비교할 것: 파일 목록, 세 파일 내용, git 상태, 마지막 커밋
function snapshot(root: string) {
  const isRepo = existsSync(join(root, ".git"));
  return {
    files: listFiles(root),
    gitignore: read(join(root, ".product/.gitignore")),
    settings: read(join(root, ".product-settings")) ?? read(join(root, "packages/api/.product-settings")),
    gitmodules: read(join(root, ".gitmodules")),
    status: isRepo ? tryGit(root, "status", "--porcelain") : null,
    commit: isRepo ? tryGit(root, "show", "--name-only", "--format=%s", "HEAD") : null,
    commits: isRepo ? tryGit(root, "rev-list", "--count", "--all") : null,
  };
}

for (const c of CASES) {
  test(`CLI 와 setup.sh 가 같다: ${c.name}`, () => {
    const a = c.fixture(tmp("product-cli-"));
    const out = run(c.cli, a.cwd);
    const cliStatus = STATUS[String(out.body.status)] ?? String(out.body.status);

    const b = c.fixture(tmp("product-sh-"));
    const r = spawnSync("sh", [SETUP_SH, ...c.sh], { cwd: b.cwd, input: "", encoding: "utf8", env: process.env });
    const shStatus = r.stdout.split("\n")[0];

    assert.equal(cliStatus, c.status, out.stderr);
    assert.equal(shStatus, c.status, r.stdout + r.stderr);
    assert.equal(r.status, out.code, "종료 코드가 같다");
    assert.deepEqual(snapshot(b.root), snapshot(a.root));
    c.check?.(a.root);
    c.check?.(b.root);
    // next 명령의 갯수도 같다
    const shNext = r.stdout.split("\n").filter((l) => l.startsWith("next: ")).length;
    if (c.status !== "STOPPED") assert.equal(shNext, (out.body.next as string[]).length, r.stdout);
  });
}

test("setup.sh inspect 는 CLI inspect 와 같은 상황을 알린다", () => {
  const d = repoWithCommit(join(tmp(), "shop"));
  const sub = at(d, "pkg");
  const r = spawnSync("sh", [SETUP_SH, "inspect"], { cwd: sub, input: "", encoding: "utf8", env: process.env });
  assert.equal(r.status, 0);
  assert.equal(
    r.stdout,
    [
      "here: none",
      "settings: none",
      "mode: none",
      "ancestor: none",
      "git.inside: true",
      `git.top: ${d}`,
      "git.isTop: false",
      "git.hasCommits: true",
      "",
    ].join("\n"),
  );
  const body = run(["inspect"], sub).body as { git: { top: string; isTop: boolean } };
  assert.equal(body.git.top, d);
  assert.equal(body.git.isTop, false);
});

test("setup.sh 는 ~/.sdd/ 를 만들지 않는다", () => {
  assert.equal(existsSync(join(home, ".sdd")), false);
});

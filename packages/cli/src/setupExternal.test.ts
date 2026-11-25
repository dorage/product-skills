import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { setupExternal } from "./setupExternal.js";
import { EXIT, run } from "./cli.js";
import { at, bareRepo, listFiles, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

const home = useTestEnv();

// 임시 bare 리포 2개와 없는 주소 1개 (design.md 테스트 전략 테스트 더블)
const remotes = tmp("product-remotes-");
const api = bareRepo(remotes, "cafe-api");
const web = bareRepo(remotes, "cafe-web");
const missing = "file:///없는/폴더/cafe-gone.git";

const json = (argv: string[], cwd: string) => {
  const out = run([...argv, "--json"], cwd);
  return { code: out.code, body: JSON.parse(out.stdout) };
};
const cleanRepos = (root: string) => {
  for (const name of readdirSync(join(root, "repos"))) {
    assert.equal(sh(join(root, "repos", name), "status", "--porcelain"), "", `repos/${name} 가 깨끗하다`);
  }
};

test("빈 폴더에서 git init 뒤 리포 2개를 repos/ 아래 submodule 로 더한다 (E4)", () => {
  const cafe = at(tmp(), "cafe");
  const { code, body } = json(["setup", "--mode", "external", "--repo", api, "--repo", web], cafe);
  assert.equal(code, EXIT.ok);
  assert.equal(body.status, "done");
  assert.equal(body.mode, "external");
  assert.equal(body.productDir, join(cafe, ".product"));
  assert.deepEqual(body.added, [
    { url: api, name: "cafe-api" },
    { url: web, name: "cafe-web" },
  ]);
  assert.deepEqual(body.skipped, []);
  // 요구사항 2 「폴더 모양」
  assert.ok(existsSync(join(cafe, ".git")));
  assert.match(readFileSync(join(cafe, ".gitmodules"), "utf8"), /path = repos\/cafe-api[\s\S]*path = repos\/cafe-web/);
  assert.equal(readFileSync(join(cafe, ".product/.gitignore"), "utf8"), "_humanize/\n_workspace/\n.*.before\n");
  assert.equal(readFileSync(join(cafe, ".product-settings"), "utf8"), "mode: external\nroot: .\ntemplates: {}\n");
  assert.deepEqual(listFiles(cafe), [
    ".gitmodules",
    ".product-settings",
    ".product/",
    ".product/.gitignore",
    "repos/",
    "repos/cafe-api/",
    "repos/cafe-web/",
  ]);
  // 실제 리포에는 파일을 만들거나 고치지 않는다 (요구사항 2 인수 조건 9)
  cleanRepos(cafe);
  // 커밋하지 않고 커밋 명령을 보여 준다 (F1), 개발 자리 한 줄 (E2)
  assert.throws(() => sh(cafe, "rev-parse", "--verify", "-q", "HEAD"));
  assert.ok(body.next.some((n: string) => /git commit -m 'chore:product 폴더 추가'/.test(n)));
  assert.ok(body.next.includes("앞으로 개발은 repos/cafe-api/ 에서 한다"));
  assert.equal(existsSync(join(home, ".sdd")), false);
});

test("E7·E8: 받지 못한 리포와 이름이 겹친 리포만 건너뛰고 명령을 보여 준다", () => {
  const cafe = at(tmp(), "cafe");
  const other = bareRepo(at(tmp("product-other-"), "other"), "cafe-api");
  const r = setupExternal(cafe, { repos: [api, missing, other], useExistingRepo: false, allowNested: false });
  assert.equal(r.status, "done");
  assert.deepEqual(r.added, [{ url: api, name: "cafe-api" }]);
  const skipped = r.skipped as { url: string; name: string; reason: string }[];
  assert.deepEqual(
    skipped.map((s) => [s.url, s.name]),
    [
      [missing, "cafe-gone"],
      [other, "cafe-api"],
    ],
  );
  assert.ok(skipped[0].reason.length > 0);
  assert.match(skipped[1].reason, /겹친다/);
  assert.ok(r.next.includes(`git submodule add ${missing.replace(/^(.*)$/, "'$1'")} repos/cafe-gone`));
  assert.ok(r.next.includes(`git submodule add ${other} repos/cafe-api`));
  // 실패한 리포의 흔적이 남지 않아 보여 준 명령을 그대로 칠 수 있다
  assert.equal(existsSync(join(cafe, "repos/cafe-gone")), false);
  assert.equal(existsSync(join(cafe, ".git/modules/repos/cafe-gone")), false);
  assert.doesNotMatch(readFileSync(join(cafe, ".gitmodules"), "utf8"), /cafe-gone/);
  cleanRepos(cafe);
});

test("E9: 받은 리포가 0개여도 .product/ 와 설정 파일을 만들고 마친다", () => {
  const cafe = at(tmp(), "cafe");
  const r = setupExternal(cafe, { repos: [missing], useExistingRepo: false, allowNested: false });
  assert.equal(r.status, "done");
  assert.deepEqual(r.added, []);
  assert.ok(existsSync(join(cafe, ".product/.gitignore")));
  assert.ok(existsSync(join(cafe, ".product-settings")));
  assert.equal(existsSync(join(cafe, ".gitmodules")), false);
  assert.ok(r.next.some((n) => n.startsWith("git submodule add")));
  assert.ok(r.next.some((n) => n === "git add .product/.gitignore .product-settings && git commit -m 'chore:product 폴더 추가'"));
});

test("E5: 다른 리포의 하위 폴더면 멈춘다 (종료 코드 6)", () => {
  const repo = repoWithCommit(join(tmp(), "shop"));
  const sub = at(repo, "docs");
  const { code, body } = json(["setup", "--mode", "external", "--repo", api], sub);
  assert.equal(code, EXIT.stopped);
  assert.match(body.reason, /리포 밖/);
  assert.equal(existsSync(join(sub, ".product")), false);
  assert.equal(existsSync(join(sub, "repos")), false);
});

test("E6: 커밋이 있는 리포면 --use-existing-repo 없이는 need (종료 코드 2)", () => {
  const repo = repoWithCommit(join(tmp(), "cafe"));
  const { code, body } = json(["setup", "--mode", "external", "--repo", api], repo);
  assert.equal(code, EXIT.need);
  assert.deepEqual(body.need, ["use-existing-repo"]);
  assert.equal(existsSync(join(repo, ".product")), false);
  const ok = json(["setup", "--mode", "external", "--repo", api, "--use-existing-repo"], repo);
  assert.equal(ok.body.status, "done");
  assert.deepEqual(ok.body.added, [{ url: api, name: "cafe-api" }]);
  cleanRepos(repo);
});

test("E3: 위쪽에 product 폴더가 있으면 --allow-nested 없이는 need", () => {
  const base = tmp();
  mkdirSync(join(base, ".product"));
  const cafe = at(base, "cafe");
  const r = setupExternal(cafe, { repos: [api], useExistingRepo: false, allowNested: false });
  assert.equal(r.status, "need");
  assert.deepEqual(r.need, ["allow-nested"]);
  assert.equal(r.ancestor, join(base, ".product"));
  assert.equal(existsSync(join(cafe, ".git")), false);
});

test("E1: 이미 셋업했으면 already 이고 리포를 더하지 않는다", () => {
  const cafe = at(tmp(), "cafe");
  setupExternal(cafe, { repos: [api], useExistingRepo: false, allowNested: false });
  const r = setupExternal(cafe, { repos: [web], useExistingRepo: true, allowNested: false });
  assert.equal(r.status, "already");
  assert.equal(r.mode, "external");
  assert.equal(existsSync(join(cafe, "repos/cafe-web")), false);
});

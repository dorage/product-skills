import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { legacyDir, legacyName } from "./legacy.js";
import { writeSettings } from "./settings.js";
import { EXIT, run } from "./cli.js";
import { at, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

const home = useTestEnv();

// 임시 ~/.sdd/ 에 예전 문서를 둔다. 테스트 전후로 그대로인지 본다 (요구사항 4 인수 조건 8)
const sdd = join(home, ".sdd");
const oldDoc = join(sdd, "cafe-api", "20261101090000_예전-기능", "requirements.md");
mkdirSync(join(oldDoc, ".."), { recursive: true });
writeFileSync(oldDoc, "예전 문서\n");
const snapshot = () => JSON.stringify(readdirSync(sdd, { recursive: true }).sort()) + readFileSync(oldDoc, "utf8");
const before = snapshot();

const json = (argv: string[], cwd: string) => {
  const out = run([...argv, "--json"], cwd);
  return { code: out.code, body: JSON.parse(out.stdout) };
};

test("이름은 origin 원격 이름에서 .git 을 뗀 것", () => {
  const repo = repoWithCommit(join(tmp(), "local-folder"));
  sh(repo, "remote", "add", "origin", "git@github.com:org/cafe-api.git");
  assert.equal(legacyName(repo), "cafe-api");
  assert.equal(legacyDir(repo, home), join(sdd, "cafe-api"));
});

test("origin 이 없으면 메인 체크아웃 폴더 이름 (워크트리 안이어도)", () => {
  const repo = repoWithCommit(join(tmp(), "cafe-api"));
  sh(repo, "worktree", "add", "-q", join(repo, ".worktrees", "feat-x"));
  assert.equal(legacyName(join(repo, ".worktrees", "feat-x")), "cafe-api");
  assert.equal(legacyDir(join(repo, ".worktrees", "feat-x"), home), join(sdd, "cafe-api"));
});

test("git 리포가 아니면 지금 폴더 이름", () => {
  const dir = at(tmp(), "cafe-api");
  assert.equal(legacyName(dir), "cafe-api");
});

test("~/.sdd/{리포 이름}/ 이 없으면 null", () => {
  const dir = at(tmp(), "shop");
  assert.equal(legacyDir(dir, home), null);
});

test("root 결과에 legacyDir 를 담는다", () => {
  const cafe = at(tmp(), "cafe-api");
  mkdirSync(join(cafe, ".product"));
  writeSettings(cafe, "internal");
  const { code, body } = json(["root"], cafe);
  assert.equal(code, EXIT.ok);
  assert.equal(body.legacyDir, join(sdd, "cafe-api"));
  assert.equal("inRepos" in body, false);
});

test("root --from: 외부 셋업 repos/ 아래 경로면 inRepos 가 리포 이름 (E15)", () => {
  const cafe = at(tmp(), "cafe");
  mkdirSync(join(cafe, ".product"));
  writeSettings(cafe, "external");
  at(cafe, "repos/cafe-api/src");
  const { code, body } = json(["root", "--from", join(cafe, "repos/cafe-api/docs/새-기능")], tmp());
  assert.equal(code, EXIT.ok);
  assert.equal(body.mode, "external");
  assert.equal(body.productDir, join(cafe, ".product"));
  assert.equal(body.inRepos, "cafe-api");
});

test("root --from: repos/ 밖이거나 내부 셋업이면 inRepos 가 null", () => {
  const cafe = at(tmp(), "cafe");
  mkdirSync(join(cafe, ".product"));
  writeSettings(cafe, "external");
  assert.equal(json(["root", "--from", join(cafe, "notes")], cafe).body.inRepos, null);
  const shop = at(tmp(), "shop");
  mkdirSync(join(shop, ".product"));
  writeSettings(shop, "internal");
  assert.equal(json(["root", "--from", join(shop, "repos/x")], shop).body.inRepos, null);
});

test("root --from: 위에 product 폴더가 없어도 실패하지 않고 mode 없음을 알린다", () => {
  const dir = tmp();
  const { code, body } = json(["root", "--from", join(dir, "out", "case-1")], dir);
  assert.equal(code, EXIT.ok);
  assert.equal(body.mode, null);
  assert.equal(body.productDir, null);
  assert.equal(body.inRepos, null);
});

test("--from 없이 product 폴더가 없으면 그대로 종료 코드 3", () => {
  assert.equal(run(["root", "--json"], tmp()).code, EXIT.notFound);
});

test("~/.sdd/ 안 파일은 그대로다", () => {
  assert.equal(snapshot(), before);
});

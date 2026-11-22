import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupInternal } from "./setupInternal.js";
import { EXIT, run } from "./cli.js";
import { at, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

const home = useTestEnv();

const shop = () => repoWithCommit(join(tmp(), "shop"));
const json = (argv: string[], cwd: string) => {
  const out = run([...argv, "--json"], cwd);
  return { code: out.code, body: JSON.parse(out.stdout) };
};
const committed = (dir: string) =>
  sh(dir, "show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean).sort();

test("리포 맨 위에서 .product/ 를 만들고 두 파일만 담은 커밋 1개를 만든다", () => {
  const dir = shop();
  writeFileSync(join(dir, "other.txt"), "staged\n");
  sh(dir, "add", "other.txt");
  const before = sh(dir, "rev-list", "--count", "HEAD").trim();

  const { code, body } = json(["setup", "--mode", "internal"], dir);
  assert.equal(code, EXIT.ok);
  assert.equal(body.status, "done");
  assert.equal(body.mode, "internal");
  assert.equal(body.productDir, join(dir, ".product"));
  assert.equal(readFileSync(join(dir, ".product/.gitignore"), "utf8"), "_humanize/\n_workspace/\n.*.before\n");
  assert.equal(readFileSync(join(dir, ".product-settings"), "utf8"), "mode: internal\nroot: .\ntemplates: {}\n");

  // 요구사항 3 「커밋」: 1개, 지금 브랜치, 정해진 메시지, 두 파일
  assert.equal(sh(dir, "rev-list", "--count", "HEAD").trim(), String(Number(before) + 1));
  assert.equal(sh(dir, "symbolic-ref", "--short", "HEAD").trim(), "main");
  assert.equal(sh(dir, "branch", "--format=%(refname:short)").trim(), "main");
  assert.equal(sh(dir, "log", "-1", "--format=%s").trim(), "chore:product 폴더 추가");
  assert.deepEqual(committed(dir), [".product-settings", ".product/.gitignore"]);
  assert.equal(body.commit, sh(dir, "rev-parse", "HEAD").trim());
  // 미리 올려 둔 변경은 커밋에 섞이지 않고 그대로 올라가 있다 (U3)
  assert.equal(sh(dir, "status", "--porcelain").trim(), "A  other.txt");
  // push 하지 않고 직접 칠 push 명령을 보여 준다
  assert.deepEqual(body.next, ["git push origin main"]);
  assert.equal(sh(dir, "remote").trim(), "");
  // ~/.sdd/ 를 만들지 않는다 (요구사항 1 인수 조건 6)
  assert.equal(existsSync(join(home, ".sdd")), false);
});

test("E11: 리포 맨 위가 아니고 --at 이 없으면 종료 코드 2 와 need at", () => {
  const dir = shop();
  const sub = at(dir, "packages/api");
  const { code, body } = json(["setup", "--mode", "internal"], sub);
  assert.equal(code, EXIT.need);
  assert.deepEqual(body.need, ["at"]);
  assert.equal(body.top, dir);
  assert.equal(existsSync(join(sub, ".product")), false);
  assert.equal(existsSync(join(dir, ".product")), false);
});

test("--at here 는 하위 폴더에 .product/ 를 만들어 커밋한다", () => {
  const dir = shop();
  const sub = at(dir, "packages/api");
  const r = setupInternal(sub, { at: "here", allowNested: false });
  assert.equal(r.status, "done");
  assert.equal(r.productDir, join(sub, ".product"));
  assert.deepEqual(committed(dir), ["packages/api/.product-settings", "packages/api/.product/.gitignore"]);
  assert.deepEqual(r.next, ["git push origin main"]);
});

test("--at top 은 리포 맨 위에 만든다", () => {
  const dir = shop();
  const sub = at(dir, "packages/api");
  const r = setupInternal(sub, { at: "top", allowNested: false });
  assert.equal(r.status, "done");
  assert.equal(r.productDir, join(dir, ".product"));
  assert.deepEqual(committed(dir), [".product-settings", ".product/.gitignore"]);
});

test("E12: git 리포 밖이면 멈추고 외부 셋업을 권한다 (종료 코드 6)", () => {
  const dir = tmp();
  const { code, body } = json(["setup", "--mode", "internal"], dir);
  assert.equal(code, EXIT.stopped);
  assert.equal(body.status, "stopped");
  assert.match(body.next[0], /--mode external/);
  assert.equal(existsSync(join(dir, ".product")), false);
});

test("E13: 커밋이 실패하면 .product/ 를 남기고 이유와 커밋 명령을 보여 준다 (종료 코드 7)", () => {
  const dir = shop();
  const hook = join(dir, ".git/hooks/pre-commit");
  writeFileSync(hook, "#!/bin/sh\necho '훅이 막았다' >&2\nexit 1\n");
  chmodSync(hook, 0o755);
  const head = sh(dir, "rev-parse", "HEAD");
  const { code, body } = json(["setup", "--mode", "internal"], dir);
  assert.equal(code, EXIT.commitFailed);
  assert.equal(body.status, "commitFailed");
  assert.match(body.reason, /훅이 막았다/);
  assert.deepEqual(body.next, [
    "git add .product/.gitignore .product-settings && git commit -m 'chore:product 폴더 추가' -- .product/.gitignore .product-settings",
  ]);
  assert.ok(existsSync(join(dir, ".product/.gitignore")));
  assert.ok(existsSync(join(dir, ".product-settings")));
  assert.equal(sh(dir, "rev-parse", "HEAD"), head);
});

test("E1: 이미 셋업했으면 만들지 않고 already 와 셋업 방식을 알린다", () => {
  const dir = shop();
  assert.equal(setupInternal(dir, { allowNested: false }).status, "done");
  const head = sh(dir, "rev-parse", "HEAD");
  const { code, body } = json(["setup", "--mode", "internal"], dir);
  assert.equal(code, EXIT.ok);
  assert.equal(body.status, "already");
  assert.equal(body.mode, "internal");
  assert.equal(sh(dir, "rev-parse", "HEAD"), head);
});

test("E2: --settings-only 는 설정 파일만 만들고 커밋하지 않는다", () => {
  const dir = shop();
  mkdirSync(join(dir, ".product"));
  const head = sh(dir, "rev-parse", "HEAD");
  const { code, body } = json(["setup", "--settings-only", "--mode", "internal"], dir);
  assert.equal(code, EXIT.ok);
  assert.equal(body.status, "done");
  assert.equal(body.commit, null);
  assert.equal(readFileSync(join(dir, ".product-settings"), "utf8"), "mode: internal\nroot: .\ntemplates: {}\n");
  assert.equal(sh(dir, "rev-parse", "HEAD"), head);
  assert.match(body.next[0], /git commit/);
});

test("E3: 위쪽에 product 폴더가 있으면 --allow-nested 없이는 need allow-nested", () => {
  const dir = shop();
  assert.equal(setupInternal(dir, { allowNested: false }).status, "done");
  const sub = at(dir, "packages/api");
  const r = setupInternal(sub, { at: "here", allowNested: false });
  assert.equal(r.status, "need");
  assert.deepEqual(r.need, ["allow-nested"]);
  assert.equal(r.ancestor, join(dir, ".product"));
  assert.equal(existsSync(join(sub, ".product")), false);
  assert.equal(setupInternal(sub, { at: "here", allowNested: true }).status, "done");
});

test("커밋이 없는 리포에서도 셋업 커밋을 만든다", () => {
  const dir = tmp();
  sh(dir, "init", "-q", "-b", "main");
  const r = setupInternal(dir, { allowNested: false });
  assert.equal(r.status, "done");
  assert.deepEqual(committed(dir), [".product-settings", ".product/.gitignore"]);
});

test("--mode 가 없으면 need mode", () => {
  const { code, body } = json(["setup"], tmp());
  assert.equal(code, EXIT.need);
  assert.deepEqual(body.need, ["mode"]);
});

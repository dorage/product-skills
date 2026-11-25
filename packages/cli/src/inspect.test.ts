import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "./inspect.js";
import { writeSettings } from "./settings.js";
import { EXIT, run } from "./cli.js";
import { at, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

useTestEnv();

test("E1: .product/ 와 설정 파일이 있으면 here.settings 가 ok 이고 mode 를 알린다", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  writeSettings(dir, "internal");
  const r = inspect(dir);
  assert.deepEqual(r.here, { productDir: join(dir, ".product"), settings: "ok", mode: "internal" });
});

test("E2: .product/ 만 있고 설정 파일이 없으면 here.settings 가 missing", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  assert.deepEqual(inspect(dir).here, {
    productDir: join(dir, ".product"),
    settings: "missing",
    mode: null,
  });
});

test("설정 파일이 깨졌으면 here.settings 가 invalid 이고 이유를 담는다", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  writeFileSync(join(dir, ".product-settings"), "mode: extrnal\nroot: .\ntemplates: {}\n");
  const here = inspect(dir).here;
  assert.equal(here?.settings, "invalid");
  assert.match(here?.reason ?? "", /extrnal/);
});

test("E3: 위쪽에 product 폴더가 있으면 ancestor 가 그 경로", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  const sub = at(dir, "a/b");
  const r = inspect(sub);
  assert.equal(r.here, null);
  assert.equal(r.ancestor, join(dir, ".product"));
});

test("지금 폴더의 .product 는 ancestor 로 보지 않는다", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  assert.equal(inspect(dir).ancestor, null);
});

test("git 리포 밖", () => {
  const dir = tmp();
  assert.deepEqual(inspect(dir).git, { inside: false, top: null, isTop: false, hasCommits: false });
});

test("커밋이 있는 리포 맨 위", () => {
  const dir = repoWithCommit(join(tmp(), "shop"));
  assert.deepEqual(inspect(dir).git, { inside: true, top: dir, isTop: true, hasCommits: true });
});

test("리포 하위 폴더", () => {
  const dir = repoWithCommit(join(tmp(), "shop"));
  const sub = at(dir, "packages/api");
  assert.deepEqual(inspect(sub).git, { inside: true, top: dir, isTop: false, hasCommits: true });
});

test("커밋이 없는 리포", () => {
  const dir = tmp();
  sh(dir, "init", "-q");
  assert.deepEqual(inspect(dir).git, { inside: true, top: dir, isTop: true, hasCommits: false });
});

test("product inspect --json 은 상황을 JSON 으로 낸다", () => {
  const dir = tmp();
  const out = run(["inspect", "--json"], dir);
  assert.equal(out.code, EXIT.ok);
  assert.deepEqual(JSON.parse(out.stdout), {
    status: "ok",
    here: null,
    ancestor: null,
    git: { inside: false, top: null, isTop: false, hasCommits: false },
  });
});

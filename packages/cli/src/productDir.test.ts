import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findProduct } from "./find.js";
import { inspect } from "./inspect.js";
import { readSettings, SettingsError } from "./settings.js";
import { EXIT, run } from "./cli.js";
import { at, repoWithCommit, sh, tmp, useTestEnv } from "./testkit.js";

// .product-settings 의 dir 로 product 폴더 이름을 바꾼다. 없으면 .product
useTestEnv();

const SETUP_SH = fileURLToPath(new URL("../../../plugins/product/skills/setup/setup.sh", import.meta.url));
const runSh = (cwd: string, ...args: string[]) =>
  spawnSync("sh", [SETUP_SH, ...args], { cwd, input: "", encoding: "utf8", env: process.env });

const settings = (mode: string, dir?: string) =>
  `mode: ${mode}\nroot: .\ntemplates: {}\n${dir === undefined ? "" : `dir: ${dir}\n`}`;

// product 폴더를 specs/ 로 바꾼 루트
const renamed = (root: string, mode = "internal", dir = "specs", folder = "specs") => {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, ".product-settings"), settings(mode, dir));
  return root;
};

test("dir 을 읽는다. 없으면 .product", () => {
  const d = tmp();
  const file = join(d, ".product-settings");
  writeFileSync(file, settings("internal"));
  assert.equal(readSettings(file).dir, ".product");
  for (const [raw, want] of [
    ["specs", "specs"],
    ["'my specs'", "my specs"],
    ['"docs/product"', "docs/product"],
    ["./specs", "./specs"],
  ]) {
    writeFileSync(file, settings("internal", raw));
    assert.equal(readSettings(file).dir, want, raw);
  }
});

for (const [name, raw, reason] of [
  ["절대 경로", "/tmp/specs", /절대 경로/],
  ["위 폴더", "../specs", /밖/],
  ["가운데 위 폴더", "a/../../b", /밖/],
  ["폴더 자체", ".", /폴더 자체/],
  ["빈 글", "''", /비었다/],
  ["문자열 아님", "[a]", /문자열/],
] as const) {
  test(`쓸 수 없는 dir: ${name}`, () => {
    const d = tmp();
    const file = join(d, ".product-settings");
    writeFileSync(file, settings("internal", raw));
    assert.throws(
      () => readSettings(file),
      (e: unknown) => e instanceof SettingsError && reason.test(e.reason),
    );
  });
}

test("root 는 세 단계 아래에서도 dir 로 바꾼 product 폴더를 돌려준다", () => {
  const root = renamed(tmp(), "external");
  const start = at(root, "repos/cafe-api/src");
  const out = run(["root", "--json"], start);
  assert.equal(out.code, EXIT.ok, out.stderr);
  const body = JSON.parse(out.stdout);
  assert.equal(body.productDir, join(root, "specs"));
  assert.equal(body.mode, "external");
});

test("dir 이 있으면 남아 있는 .product/ 대신 dir 을 쓴다", () => {
  const root = renamed(tmp());
  mkdirSync(join(root, ".product"));
  assert.equal(findProduct(root)?.productDir, join(root, "specs"));
});

test("설정 파일이 있으면 .product/ 가 없어도 product 루트로 본다", () => {
  const root = tmp();
  writeFileSync(join(root, ".product-settings"), settings("internal"));
  assert.equal(findProduct(at(root, "a/b"))?.productDir, join(root, ".product"));
});

test("dir 이 쓸 수 없는 값이면 root 는 종료 코드 4 로 멈추고 위쪽으로 넘어가지 않는다", () => {
  const outer = renamed(tmp());
  const inner = at(outer, "inner");
  writeFileSync(join(inner, ".product-settings"), settings("internal", "../specs"));
  const out = run(["root", "--json"], inner);
  assert.equal(out.code, EXIT.settings);
  const body = JSON.parse(out.stdout);
  assert.match(body.reason, /밖/);
  assert.equal(body.productDir, join(inner, ".product"));
});

test("inspect 는 dir 로 바꾼 폴더를 here 와 ancestor 로 알린다", () => {
  const root = renamed(tmp());
  assert.deepEqual(inspect(root).here, { productDir: join(root, "specs"), settings: "ok", mode: "internal" });
  assert.equal(inspect(at(root, "sub")).ancestor, join(root, "specs"));
});

test("내부 셋업: dir 로 바꿨으면 CLI 와 setup.sh 모두 already 이고 .product/ 를 만들지 않는다", () => {
  const shop = renamed(repoWithCommit(join(tmp(), "shop")));
  const head = sh(shop, "rev-parse", "HEAD");

  const out = run(["setup", "--mode", "internal", "--json"], shop);
  assert.equal(out.code, EXIT.ok, out.stderr);
  assert.equal(JSON.parse(out.stdout).status, "already");
  assert.equal(JSON.parse(out.stdout).productDir, join(shop, "specs"));

  const r = runSh(shop, "internal", "top");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.stdout.trim().split("\n"), ["ALREADY", "mode: internal", `productDir: ${shop}/specs`]);

  assert.equal(existsSync(join(shop, ".product")), false);
  assert.equal(sh(shop, "rev-parse", "HEAD"), head);
});

test("외부 셋업: dir 로 바꿨으면 CLI 와 setup.sh 모두 already", () => {
  const cafe = renamed(at(tmp(), "cafe"), "external", "'my specs'", "my specs");
  const out = run(["setup", "--mode", "external", "--repo", "file:///x/cafe-api.git", "--json"], cafe);
  assert.equal(out.code, EXIT.ok, out.stderr);
  assert.equal(JSON.parse(out.stdout).status, "already");

  const r = runSh(cafe, "external", "file:///x/cafe-api.git");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.split("\n")[2], `productDir: ${cafe}/my specs`);
  assert.equal(existsSync(join(cafe, ".product")), false);
  assert.equal(existsSync(join(cafe, "repos")), false);
});

test("setup.sh inspect 도 dir 로 바꾼 폴더를 알리고, 쓸 수 없는 dir 은 invalid", () => {
  const root = renamed(tmp());
  let r = runSh(root, "inspect");
  assert.match(r.stdout, new RegExp(`^here: ${root}/specs$`, "m"));
  assert.match(r.stdout, /^settings: ok$/m);
  r = runSh(at(root, "sub"), "inspect");
  assert.match(r.stdout, new RegExp(`^ancestor: ${root}/specs$`, "m"));

  writeFileSync(join(root, ".product-settings"), settings("internal", "/abs"));
  r = runSh(root, "inspect");
  assert.match(r.stdout, /^settings: invalid$/m);
  assert.equal(inspect(root).here?.settings, "invalid");
});

// setup.sh 는 YAML 파서 없이 sed 로 읽는다. 자주 쓸 모양에서 CLI 와 같은 판단을 하는지 본다
for (const [raw, want] of [
  ["", ".product"],
  ["specs # 주석", "specs"],
  ["'my specs' # 주석", "my specs"],
  ["''", null],
  ["../x", null],
] as const) {
  test(`setup.sh 와 CLI 가 dir: ${raw || "(빈 값)"} 을 같게 읽는다`, () => {
    const root = tmp();
    writeFileSync(join(root, ".product-settings"), settings("internal", raw));
    const here = inspect(root).here;
    const r = runSh(root, "inspect");
    if (want === null) {
      assert.equal(here?.settings, "invalid");
      assert.match(r.stdout, /^settings: invalid$/m);
    } else {
      assert.equal(here?.settings, "ok", here?.reason);
      assert.equal(here?.productDir, join(root, want));
      assert.match(r.stdout, /^settings: ok$/m);
      assert.match(r.stdout, new RegExp(`^here: ${root}/${want}$`, "m"));
    }
  });
}

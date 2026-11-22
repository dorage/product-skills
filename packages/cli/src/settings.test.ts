import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { readSettings, SettingsError, writeSettings } from "./settings.js";
import { EXIT, run } from "./cli.js";

const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), "product-settings-")));

for (const mode of ["external", "internal"] as const) {
  test(`${mode} 셋업 설정 파일을 쓰고 읽는다 (요구사항 6 「설정 파일 내용」)`, () => {
    const dir = tmp();
    const file = writeSettings(dir, mode);
    assert.equal(file, join(dir, ".product-settings"));
    assert.deepEqual(parse(readFileSync(file, "utf8")), { mode, root: ".", templates: {} });
    assert.deepEqual(readSettings(file), { mode, root: dir, templates: {} });
  });
}

test("root 는 설정 파일이 있는 폴더를 기준으로 절대 경로로 푼다", () => {
  const dir = tmp();
  const file = join(dir, ".product-settings");
  writeFileSync(file, "mode: internal\nroot: sub\ntemplates: {}\n");
  assert.equal(readSettings(file).root, join(dir, "sub"));
});

test("모르는 키는 무시한다", () => {
  const dir = tmp();
  const file = join(dir, ".product-settings");
  writeFileSync(file, "mode: internal\nroot: .\ntemplates: {}\nextra: 1\n");
  assert.deepEqual(readSettings(file), { mode: "internal", root: dir, templates: {} });
});

const broken: [string, string | null, RegExp][] = [
  ["파일 없음", null, /없다/],
  ["키 빠짐", "mode: internal\ntemplates: {}\n", /root/],
  ["모르는 mode", "mode: extrnal\nroot: .\ntemplates: {}\n", /extrnal/],
  ["templates 가 맵이 아님", "mode: internal\nroot: .\ntemplates: [a]\n", /templates/],
  ["YAML 이 아닌 글", "mode: [internal\nroot: .\n", /YAML/],
  ["맵이 아닌 YAML", "그냥 글\n", /맵/],
];
for (const [name, body, reason] of broken) {
  test(`깨진 설정 파일: ${name}`, () => {
    const dir = tmp();
    const file = join(dir, ".product-settings");
    if (body !== null) writeFileSync(file, body);
    assert.throws(
      () => readSettings(file),
      (e: unknown) => e instanceof SettingsError && e.file === file && reason.test(e.reason),
    );
  });
}

test("root 는 찾은 product 폴더 옆 설정 파일의 mode 와 root 를 돌려준다", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  writeSettings(dir, "external");
  const start = join(dir, "repos", "cafe-api", "src");
  mkdirSync(start, { recursive: true });
  const out = run(["root", "--json"], start);
  assert.equal(out.code, EXIT.ok);
  assert.deepEqual(JSON.parse(out.stdout), {
    status: "ok",
    productDir: join(dir, ".product"),
    mode: "external",
    root: dir,
    legacyDir: null,
  });
});

test("root 는 설정 파일이 깨졌으면 종료 코드 4 와 파일 경로를 낸다 (E23)", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  writeFileSync(join(dir, ".product-settings"), "mode: extrnal\nroot: .\ntemplates: {}\n");
  const out = run(["root", "--json"], dir);
  assert.equal(out.code, EXIT.settings);
  const body = JSON.parse(out.stdout);
  assert.equal(body.status, "settings");
  assert.match(body.reason, /\.product-settings/);
  assert.match(body.reason, /extrnal/);
  assert.deepEqual(body.next, ["/product:setup"]);
});

test("root 는 설정 파일이 없으면 종료 코드 4 (E23)", () => {
  const dir = tmp();
  mkdirSync(join(dir, ".product"));
  const out = run(["root", "--json"], dir);
  assert.equal(out.code, EXIT.settings);
});

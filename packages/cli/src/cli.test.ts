import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, runInteractive } from "./cli.js";
import { at, bareRepo, repoWithCommit, tmp, useTestEnv } from "./testkit.js";

useTestEnv();

const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));

// 진짜 진입점을 표준 입력 파이프로 부른다. 묻는 창을 기다리면 timeout 으로 실패한다
const spawnCli = (args: string[], cwd: string) => {
  const r = spawnSync(process.execPath, [...process.execArgv, CLI, ...args], {
    cwd,
    input: "",
    encoding: "utf8",
    timeout: 20000,
    env: process.env,
  });
  assert.equal(r.error, undefined, String(r.error));
  return r;
};

test("E24: 표준 입력이 파이프이고 옵션이 없으면 묻지 않고 종료 코드 2 와 need 를 낸다", () => {
  const dir = tmp();
  const r = spawnCli(["setup", "--json"], dir);
  assert.equal(r.status, EXIT.need, r.stderr);
  const body = JSON.parse(r.stdout);
  assert.equal(body.status, "need");
  assert.deepEqual(body.need, ["mode"]);
  assert.equal(existsSync(join(dir, ".product")), false);
});

test("E24: 외부 셋업에 --repo 가 없으면 need repo", () => {
  const dir = tmp();
  const r = spawnCli(["setup", "--mode", "external", "--json"], dir);
  assert.equal(r.status, EXIT.need, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).need, ["repo"]);
  assert.equal(existsSync(join(dir, ".git")), false);
});

test("E24: 내부 셋업을 하위 폴더에서 --at 없이 부르면 need at", () => {
  const repo = repoWithCommit(join(tmp(), "shop"));
  const r = spawnCli(["setup", "--mode", "internal", "--json"], at(repo, "pkg"));
  assert.equal(r.status, EXIT.need, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).need, ["at"]);
});

test("터미널이면 빠진 답을 물어 옵션으로 붙인다", async () => {
  const remotes = tmp("product-remotes-");
  const api = bareRepo(remotes, "cafe-api");
  const cafe = at(tmp(), "cafe");
  const answers = ["external", api, ""];
  const asked: string[] = [];
  const out = await runInteractive(["setup", "--json"], cafe, true, async (q) => {
    asked.push(q);
    return answers.shift() ?? "";
  });
  assert.equal(out.code, EXIT.ok, out.stderr);
  assert.equal(out.body.status, "done");
  assert.deepEqual(out.body.added, [{ url: api, name: "cafe-api" }]);
  assert.equal(asked.length, 3);
});

test("터미널에서 '아니오' 로 답하면 셋업을 하지 않고 종료 코드 6", async () => {
  const repo = repoWithCommit(join(tmp(), "cafe"));
  const out = await runInteractive(["setup", "--mode", "external", "--repo", "x"], repo, true, async () => "n");
  assert.equal(out.code, EXIT.stopped);
  assert.equal(existsSync(join(repo, ".product")), false);
});

test("터미널이 아니면 runInteractive 도 묻지 않는다", async () => {
  const out = await runInteractive(["setup", "--json"], tmp(), false, async () => {
    throw new Error("물으면 안 된다");
  });
  assert.equal(out.code, EXIT.need);
});

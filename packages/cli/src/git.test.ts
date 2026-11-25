import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { git, gitEnv } from "./git.js";

const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), "product-git-")));

test("git 을 실행해 종료 코드와 출력을 돌려준다", () => {
  const dir = tmp();
  assert.equal(git(["init", "-q"], dir).code, 0);
  const r = git(["rev-parse", "--is-inside-work-tree"], dir);
  assert.deepEqual(r, { code: 0, stdout: "true\n", stderr: "" });
  assert.notEqual(git(["rev-parse", "HEAD"], dir).code, 0);
});

test("표준 입력이 터미널이 아니면 묻지 않는 환경 변수를 붙인다 (U2)", () => {
  const env = gitEnv(false, {});
  assert.equal(env.GIT_TERMINAL_PROMPT, "0");
  assert.match(env.GIT_SSH_COMMAND ?? "", /BatchMode=yes/);
});

test("표준 입력이 터미널이면 환경을 그대로 둔다", () => {
  const env = gitEnv(true, { PATH: "/bin" });
  assert.deepEqual(env, { PATH: "/bin" });
});

test("파이프 입력으로 부른 실행에서 git 이 환경 변수를 받는다", () => {
  const dir = tmp();
  const gitModule = join(fileURLToPath(new URL(".", import.meta.url)), "git.ts");
  const script = `
    const { git } = await import(${JSON.stringify(gitModule)});
    const r = git(["-c", "alias.envdump=!env", "envdump"], process.cwd());
    process.stdout.write(r.stdout);
  `;
  const env = { ...process.env };
  delete env.GIT_TERMINAL_PROMPT;
  delete env.GIT_SSH_COMMAND;
  const r = spawnSync(process.execPath, [...process.execArgv, "--input-type=module", "-e", script], {
    cwd: dir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    input: "",
  });
  assert.equal(r.status, 0, r.stderr.toString());
  const out = r.stdout.toString();
  assert.match(out, /^GIT_TERMINAL_PROMPT=0$/m);
  assert.match(out, /^GIT_SSH_COMMAND=.*BatchMode=yes/m);
});

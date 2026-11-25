import { spawnSync } from "node:child_process";

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

// U2: 표준 입력이 터미널이 아니면 git 이 비밀번호나 키 암호를 묻지 않고 실패하게 한다
export function gitEnv(stdinIsTTY: boolean, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (stdinIsTTY) return base;
  return {
    ...base,
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: `${base.GIT_SSH_COMMAND ?? "ssh"} -o BatchMode=yes`,
  };
}

export function git(args: string[], cwd: string): GitResult {
  const r = spawnSync("git", args, {
    cwd,
    env: gitEnv(process.stdin.isTTY === true),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (r.error) return { code: 127, stdout: "", stderr: r.error.message };
  return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

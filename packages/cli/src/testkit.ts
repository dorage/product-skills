// 테스트에서만 쓰는 도우미. tsconfig 에서 빌드에서 뺀다
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export const tmp = (prefix = "product-"): string => realpathSync(mkdtempSync(join(tmpdir(), prefix)));

// git() 은 process.env 를 읽으므로 파일 맨 위에서 한 번 부른다.
// HOME 을 임시 폴더로, 사용자·시스템 git 설정을 끊고, 로컬 bare 리포를 submodule 주소로 쓰도록
// protocol.file.allow 를 환경 변수로만 넘긴다 (design.md 테스트 전략 테스트 더블)
export function useTestEnv(): string {
  const home = tmp("product-home-");
  Object.assign(process.env, {
    HOME: home,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "protocol.file.allow",
    GIT_CONFIG_VALUE_0: "always",
  });
  return home;
}

export const sh = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, env: process.env, stdio: "pipe" }).toString();

export const at = (base: string, p: string): string => {
  mkdirSync(join(base, p), { recursive: true });
  return join(base, p);
};

// 커밋 1개가 있는 리포
export function repoWithCommit(dir: string): string {
  mkdirSync(dir, { recursive: true });
  sh(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README"), "x\n");
  sh(dir, "add", "README");
  sh(dir, "commit", "-q", "-m", "init");
  return dir;
}

// 커밋 1개가 있는 bare 리포. submodule 주소로 쓴다
export function bareRepo(base: string, name: string): string {
  const seed = repoWithCommit(join(base, `${name}-seed`));
  const bare = join(base, `${name}.git`);
  execFileSync("git", ["clone", "-q", "--bare", seed, bare], { env: process.env, stdio: "pipe" });
  return bare;
}

// .git 과 submodule 안을 빼고 폴더 아래 파일을 상대 경로로 나열한다
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === ".git") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        out.push(`${relative(dir, p)}/`);
        if (!readdirSync(p).includes(".git")) walk(p);
      } else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

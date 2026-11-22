import { statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { git } from "./git.js";

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// 아직 없는 경로를 받아도 git 을 돌릴 수 있게 가장 가까운 있는 폴더로 올라간다
const existingDir = (p: string): string => {
  let dir = resolve(p);
  while (!isDir(dir) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
};

// 예전 setup 「이름 정하기」와 같은 순서: origin 원격 이름 → 메인 체크아웃 폴더 이름 → 지금 폴더 이름
export function legacyName(cwd: string): string {
  const dir = existingDir(cwd);
  const inside = git(["rev-parse", "--is-inside-work-tree"], dir);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") return basename(resolve(cwd));
  const origin = git(["remote", "get-url", "origin"], dir);
  if (origin.code === 0 && origin.stdout.trim()) {
    return basename(origin.stdout.trim().replace(/[/\\]+$/, "")).replace(/\.git$/, "");
  }
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], dir).stdout.trim();
  return basename(dirname(common));
}

// 예전 보관 폴더 ~/.sdd/{리포 이름}/ 이 있으면 경로를 알려 준다. 읽기만 한다 (요구사항 4 인수 조건 8·9)
export function legacyDir(cwd: string, home: string): string | null {
  const dir = join(home, ".sdd", legacyName(cwd));
  return isDir(dir) ? dir : null;
}

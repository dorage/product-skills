import { realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findProduct } from "./find.js";
import { git } from "./git.js";
import { type Mode, readSettings, SETTINGS_FILE, SettingsError } from "./settings.js";

export interface Here {
  productDir: string;
  settings: "ok" | "missing" | "invalid";
  mode: Mode | null;
  reason?: string;
}

export interface GitState {
  inside: boolean;
  top: string | null;
  isTop: boolean;
  hasCommits: boolean;
}

export interface Inspection {
  here: Here | null;
  ancestor: string | null;
  git: GitState;
}

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const real = (p: string): string => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};

// 폴더 하나에 .product/ 와 설정 파일이 있는지 본다 (E1·E2)
export function productHere(dir: string): Here | null {
  const productDir = join(dir, ".product");
  if (!isDir(productDir)) return null;
  try {
    const s = readSettings(join(dir, SETTINGS_FILE));
    return { productDir, settings: "ok", mode: s.mode };
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    // readSettings 는 파일이 없을 때와 깨졌을 때를 같은 오류로 낸다. 파일 유무로 나눈다
    let exists = true;
    try {
      statSync(join(dir, SETTINGS_FILE));
    } catch {
      exists = false;
    }
    return exists
      ? { productDir, settings: "invalid", mode: null, reason: `${e.file}: ${e.reason}` }
      : { productDir, settings: "missing", mode: null };
  }
}

// 지금 폴더보다 위쪽에서 가장 가까운 product 폴더 (E3)
export function ancestorOf(dir: string): string | null {
  const parent = dirname(resolve(dir));
  if (parent === resolve(dir)) return null;
  return findProduct(parent)?.productDir ?? null;
}

export function gitState(cwd: string): GitState {
  const inside = git(["rev-parse", "--is-inside-work-tree"], cwd);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") {
    return { inside: false, top: null, isTop: false, hasCommits: false };
  }
  const top = git(["rev-parse", "--show-toplevel"], cwd).stdout.trim() || null;
  const hasCommits = git(["rev-parse", "--verify", "-q", "HEAD"], cwd).code === 0;
  return { inside: true, top, isTop: top !== null && real(top) === real(cwd), hasCommits };
}

// 셋업 전에 스킬이 물을 것을 정하도록 지금 폴더 상황을 알려 준다
export function inspect(cwd: string): Inspection {
  return { here: productHere(cwd), ancestor: ancestorOf(cwd), git: gitState(cwd) };
}

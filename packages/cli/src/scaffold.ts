import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { productHere } from "./inspect.js";
import { type Mode, SETTINGS_FILE, writeSettings } from "./settings.js";

// 두 셋업이 함께 쓰는 결과 모양과 product 폴더 만들기

export type SetupStatus = "done" | "already" | "need" | "stopped" | "commitFailed" | "settings" | "error";

export interface Skipped {
  url: string;
  name: string;
  reason: string;
}

export interface SetupResult {
  status: SetupStatus;
  mode: Mode | null;
  productDir: string | null;
  reason?: string;
  need?: string[];
  [key: string]: unknown;
  next: string[];
}

// 요구사항 3 「커밋」
export const COMMIT_MESSAGE = "chore:product 폴더 추가";
export const GITIGNORE = "_humanize/\n_workspace/\n.*.before\n";
export const GITIGNORE_FILE = ".product/.gitignore";

// 명령 줄에 그대로 붙여 넣을 수 있게 필요할 때만 작은따옴표로 감싼다
export const q = (s: string): string => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

// 다음 명령을 product 루트에서 치게 한다. 지금 폴더와 다르면 cd 를 앞에 붙인다
export const inDir = (target: string, cwd: string, cmd: string): string =>
  target === cwd ? cmd : `cd ${q(target)} && ${cmd}`;

export const lastLine = (text: string): string =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .pop() ?? "";

// .product/ 와 .product/.gitignore 를 만든다. .gitignore 가 이미 있으면 덮어쓰지 않는다
export function createProductDir(rootDir: string): string {
  const productDir = join(rootDir, ".product");
  mkdirSync(productDir, { recursive: true });
  const ignore = join(rootDir, GITIGNORE_FILE);
  if (!existsSync(ignore)) writeFileSync(ignore, GITIGNORE);
  return productDir;
}

// E2: .product/ 만 있을 때 설정 파일만 만든다. 커밋하지 않고 직접 칠 커밋 명령을 보여 준다
// (design.md 「요구사항에서 문자 그대로 따른 자리」 둘째 항목)
export function settingsOnly(rootDir: string, mode: Mode, cwd: string = rootDir): SetupResult {
  const here = productHere(rootDir);
  if (!here) {
    return {
      status: "error",
      mode: null,
      productDir: null,
      reason: `${rootDir} 에 .product/ 가 없다`,
      next: [`product setup --mode ${mode}`],
    };
  }
  const already = alreadyResult(here);
  if (already) return already;
  writeSettings(rootDir, mode);
  return {
    status: "done",
    mode,
    productDir: here.productDir,
    commit: null,
    next: [inDir(rootDir, cwd, `git add ${SETTINGS_FILE} && git commit -m ${q(COMMIT_MESSAGE)} -- ${SETTINGS_FILE}`)],
  };
}

// E1 과 깨진 설정 파일. 둘 다 아니면 null
export function alreadyResult(here: NonNullable<ReturnType<typeof productHere>>): SetupResult | null {
  if (here.settings === "ok") {
    return { status: "already", mode: here.mode, productDir: here.productDir, next: [] };
  }
  if (here.settings === "invalid") {
    return {
      status: "settings",
      mode: null,
      productDir: here.productDir,
      reason: here.reason ?? "설정 파일을 읽을 수 없다",
      next: ["설정 파일을 고치거나 지운 뒤 다시 셋업한다"],
    };
  }
  return null;
}

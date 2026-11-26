import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse } from "yaml";

export type Mode = "external" | "internal";

export interface Settings {
  mode: Mode;
  // 설정 파일이 있는 폴더를 기준으로 푼 절대 경로
  root: string;
  templates: Record<string, unknown>;
  // product 폴더 이름. 설정 파일이 있는 폴더 기준 상대 경로. 설정 파일에 없으면 DEFAULT_DIR
  dir: string;
}

export class SettingsError extends Error {
  constructor(
    public file: string,
    public reason: string,
  ) {
    super(`${file}: ${reason}`);
  }
}

export const SETTINGS_FILE = ".product-settings";
export const DEFAULT_DIR = ".product";

// dir 값이 쓸 수 있는 상대 경로인지 본다. 쓸 수 있으면 null, 아니면 이유
function dirProblem(dir: unknown): string | null {
  if (typeof dir !== "string") return "dir 이 문자열이 아니다";
  const t = dir.trim();
  if (t === "") return "dir 이 비었다";
  if (isAbsolute(t)) return `dir: ${t} 은 절대 경로다. 설정 파일 기준 상대 경로를 쓴다`;
  const parts = t.split(/[\\/]+/).filter((p) => p !== "" && p !== ".");
  if (parts.length === 0) return `dir: ${t} 은 설정 파일이 있는 폴더 자체다`;
  if (parts.includes("..")) return `dir: ${t} 은 설정 파일이 있는 폴더 밖을 가리킨다`;
  return null;
}

// 요구사항 6 「설정 파일 내용」. root 는 상대 경로, templates 는 비워 둔다
export function writeSettings(rootDir: string, mode: Mode): string {
  const file = join(rootDir, SETTINGS_FILE);
  writeFileSync(file, `mode: ${mode}\nroot: .\ntemplates: {}\n`);
  return file;
}

const isMap = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// 읽기 규칙 (design.md 데이터 흐름 `.product-settings`). 모르는 키는 무시한다
export function readSettings(file: string): Settings {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new SettingsError(file, "설정 파일이 없다");
  }
  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    throw new SettingsError(file, `YAML 로 읽을 수 없다 (${(e as Error).message.split("\n")[0]})`);
  }
  if (!isMap(data)) throw new SettingsError(file, "YAML 맵이 아니다");
  const { mode, root, templates, dir } = data;
  if (mode !== "external" && mode !== "internal") {
    throw new SettingsError(
      file,
      mode === undefined ? "mode 가 없다" : `mode: ${String(mode)} 은 모르는 값이다 (external·internal)`,
    );
  }
  if (typeof root !== "string") {
    throw new SettingsError(file, root === undefined ? "root 가 없다" : "root 가 문자열이 아니다");
  }
  if (!isMap(templates)) {
    throw new SettingsError(file, templates === undefined ? "templates 가 없다" : "templates 가 맵이 아니다");
  }
  if (dir !== undefined && dir !== null) {
    const problem = dirProblem(dir);
    if (problem) throw new SettingsError(file, problem);
  }
  return {
    mode,
    root: resolve(dirname(file), root),
    templates,
    dir: typeof dir === "string" ? dir.trim() : DEFAULT_DIR,
  };
}

// product 폴더 이름만 너그럽게 읽는다. 설정 파일이 깨졌거나 dir 이 쓸 수 없는 값이면 DEFAULT_DIR.
// 깨진 설정 파일도 어느 폴더의 것인지는 알려야 해서 readSettings 와 따로 둔다
export function productDirName(file: string): string {
  try {
    const data: unknown = parse(readFileSync(file, "utf8"));
    if (isMap(data) && typeof data.dir === "string" && dirProblem(data.dir) === null) return data.dir.trim();
  } catch {
    // 아래 기본값
  }
  return DEFAULT_DIR;
}

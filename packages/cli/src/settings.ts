import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type Mode = "external" | "internal";

export interface Settings {
  mode: Mode;
  // 설정 파일이 있는 폴더를 기준으로 푼 절대 경로
  root: string;
  templates: Record<string, unknown>;
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
  const { mode, root, templates } = data;
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
  return { mode, root: resolve(dirname(file), root), templates };
}

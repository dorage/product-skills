import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export type Mode = "external" | "internal";

export interface Settings {
  mode: Mode;
  // 설정 파일이 있는 폴더를 기준으로 푼 절대 경로
  root: string;
  templates: Record<string, unknown>;
  // product 폴더 이름. 설정 파일이 있는 폴더 바로 아래 폴더 하나. 설정 파일에 없으면 DEFAULT_PRODUCT_DIR_NAME
  productDirName: string;
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
export const DEFAULT_PRODUCT_DIR_NAME = ".product";

// productDirName 이 폴더 이름 하나인지 본다. 쓸 수 있으면 null, 아니면 이유.
// 경로가 아니라 이름이라 / 나 \ 를 넣을 수 없고, 설정 파일이 있는 폴더 자체(.)나 위 폴더(..)도 안 된다
function nameProblem(name: unknown): string | null {
  if (typeof name !== "string") return "productDirName 이 문자열이 아니다";
  const t = name.trim();
  if (t === "") return "productDirName 이 비었다";
  if (/[\\/]/.test(t)) return `productDirName: ${t} 은 경로다. 폴더 이름 하나만 쓴다`;
  if (t === "." || t === "..") return `productDirName: ${t} 은 폴더 이름으로 쓸 수 없다`;
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
  const { mode, root, templates, productDirName } = data;
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
  if (productDirName !== undefined && productDirName !== null) {
    const problem = nameProblem(productDirName);
    if (problem) throw new SettingsError(file, problem);
  }
  return {
    mode,
    root: resolve(dirname(file), root),
    templates,
    productDirName: typeof productDirName === "string" ? productDirName.trim() : DEFAULT_PRODUCT_DIR_NAME,
  };
}

// product 폴더 이름만 너그럽게 읽는다. 설정 파일이 깨졌거나 productDirName 이 쓸 수 없는 값이면 기본 이름.
// 깨진 설정 파일도 어느 폴더의 것인지는 알려야 해서 readSettings 와 따로 둔다
export function readProductDirName(file: string): string {
  try {
    const data: unknown = parse(readFileSync(file, "utf8"));
    const name = isMap(data) ? data.productDirName : undefined;
    if (typeof name === "string" && nameProblem(name) === null) return name.trim();
  } catch {
    // 아래 기본값
  }
  return DEFAULT_PRODUCT_DIR_NAME;
}

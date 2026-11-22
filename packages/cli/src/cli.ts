#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { findProduct } from "./find.js";
import { inspect as inspectDir } from "./inspect.js";
import { legacyDir } from "./legacy.js";
import { type SetupResult, settingsOnly } from "./scaffold.js";
import { setupInternal } from "./setupInternal.js";
import { setupExternal } from "./setupExternal.js";
import { readSettings, SettingsError } from "./settings.js";
import { atLeast } from "./version.js";

// 종료 코드 (design.md 「오류 처리」)
export const EXIT = {
  ok: 0,
  error: 1,
  need: 2,
  notFound: 3,
  settings: 4,
  version: 5,
  stopped: 6,
  commitFailed: 7,
} as const;

export type ExitName = keyof typeof EXIT;

export class CliError extends Error {
  constructor(
    public status: ExitName,
    public reason: string,
    public next: string[] = [],
    public extra: Record<string, unknown> = {},
  ) {
    super(reason);
  }
}

export const VERSION: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

export interface Output {
  code: number;
  stdout: string;
  stderr: string;
}

type Result = Record<string, unknown>;
type Options = NonNullable<Parameters<typeof parseArgs>[0]>["options"];
type Values = Record<string, string | boolean | string[] | boolean[] | undefined>;
interface Ctx {
  cwd: string;
}
interface Command {
  options: Options;
  run(values: Values, positionals: string[], ctx: Ctx): Result;
}

// 모든 명령이 받는 옵션
const GLOBAL_OPTIONS = {
  json: { type: "boolean" },
  version: { type: "boolean" },
  expect: { type: "string" },
} as const satisfies Options;

const root: Command = {
  options: { from: { type: "string" } },
  run(values, _positionals, ctx) {
    // V2: 경로를 받으면 그 경로에서 찾고, product 폴더가 없어도 실패로 보지 않는다
    const from = typeof values.from === "string" ? resolve(ctx.cwd, values.from) : undefined;
    const start = from ?? ctx.cwd;
    const legacy = legacyDir(start, homedir());
    const found = findProduct(start);
    if (!found) {
      if (from !== undefined) {
        return { productDir: null, mode: null, root: null, inRepos: null, legacyDir: legacy };
      }
      throw new CliError("notFound", `${ctx.cwd} 에서 위로 올라가도 .product/ 가 없다`, [
        "/product:setup",
      ]);
    }
    let settings;
    try {
      settings = readSettings(found.settingsFile);
    } catch (e) {
      if (e instanceof SettingsError) {
        throw new CliError("settings", `${e.file}: ${e.reason}`, ["/product:setup"], {
          productDir: found.productDir,
          file: e.file,
        });
      }
      throw e;
    }
    const result: Result = {
      productDir: found.productDir,
      mode: settings.mode,
      root: settings.root,
      legacyDir: legacy,
    };
    if (from !== undefined) result.inRepos = inRepos(from, settings.mode, settings.root);
    return result;
  },
};

// E15: 외부 셋업 product 루트의 repos/{이름}/ 아래면 그 이름
function inRepos(path: string, mode: string, rootDir: string): string | null {
  if (mode !== "external") return null;
  const parts = relative(rootDir, path).split(sep);
  return parts[0] === "repos" && parts[1] ? parts[1] : null;
}

const inspect: Command = {
  options: {},
  run(_values, _positionals, ctx) {
    return { ...inspectDir(ctx.cwd) };
  },
};

const MODES = ["external", "internal"] as const;
const PLACES = ["top", "here"] as const;

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new CliError("error", `--${name} 는 ${allowed.join("·")} 중 하나다: ${String(value)}`);
}

const setup: Command = {
  options: {
    mode: { type: "string" },
    at: { type: "string" },
    "allow-nested": { type: "boolean" },
    "settings-only": { type: "boolean" },
    repo: { type: "string", multiple: true },
    "use-existing-repo": { type: "boolean" },
  },
  run(values, _positionals, ctx): SetupResult {
    const mode = oneOf("mode", values.mode, MODES);
    const at = oneOf("at", values.at, PLACES);
    const allowNested = values["allow-nested"] === true;
    if (mode === undefined) {
      return {
        status: "need",
        mode: null,
        productDir: null,
        reason: "셋업 방식(--mode external|internal)이 없다",
        need: ["mode"],
        next: ["product setup --mode external --repo <리포 주소>", "product setup --mode internal"],
      };
    }
    if (values["settings-only"] === true) return settingsOnly(ctx.cwd, mode);
    if (mode === "internal") return setupInternal(ctx.cwd, { at, allowNested });
    return setupExternal(ctx.cwd, {
      repos: (values.repo as string[] | undefined) ?? [],
      useExistingRepo: values["use-existing-repo"] === true,
      allowNested,
    });
  },
};

// 하위 명령은 여기에 더한다
const COMMANDS: Record<string, Command> = { root, inspect, setup };

const human = (r: Result): string =>
  Object.entries(r)
    .filter(([k]) => k !== "status")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

// 값을 받는 공통 옵션을 건너뛰고 처음 나오는 옵션 아닌 낱말을 하위 명령 이름으로 본다
function commandIndex(argv: string[]): number {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--expect") {
      i++;
      continue;
    }
    if (!a.startsWith("-")) return i;
  }
  return -1;
}

function checkExpect(expect: unknown): void {
  if (typeof expect !== "string") return;
  if (!atLeast(VERSION, expect)) {
    throw new CliError(
      "version",
      `product CLI ${VERSION} 가 기대 버전 ${expect} 보다 낮다`,
      ["/product:setup"],
      { version: VERSION, expect },
    );
  }
}

export function run(argv: string[], cwd: string = process.cwd()): Output {
  const json = argv.includes("--json");
  try {
    const at = commandIndex(argv);
    const name = at >= 0 ? argv[at] : undefined;
    const cmd = name !== undefined ? COMMANDS[name] : undefined;
    if (name !== undefined && !cmd) {
      throw new CliError("error", `모르는 명령: ${name}`, [
        `product ${Object.keys(COMMANDS).join("|")} [--json] [--expect <버전>]`,
      ]);
    }
    const { values, positionals } = parseArgs({
      args: at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 1)] : argv,
      options: { ...GLOBAL_OPTIONS, ...cmd?.options },
      allowPositionals: true,
      strict: true,
    });
    checkExpect(values.expect);
    if (!cmd) {
      if (values.version === true) return { code: EXIT.ok, stdout: `${VERSION}\n`, stderr: "" };
      throw new CliError("error", "명령이 없다", [
        `product ${Object.keys(COMMANDS).join("|")} [--json] [--expect <버전>]`,
      ]);
    }
    const result = { status: "ok", ...cmd.run(values as Values, positionals, { cwd }) };
    // 셋업 결과는 status 로 갈래를 알린다. done·already·ok 는 0, 나머지는 「오류 처리」 종료 코드
    const code = (EXIT as Record<string, number>)[result.status] ?? EXIT.ok;
    return {
      code,
      stdout: `${json ? JSON.stringify(result) : human(result)}\n`,
      stderr: "",
    };
  } catch (e) {
    const err =
      e instanceof CliError ? e : new CliError("error", e instanceof Error ? e.message : String(e));
    const body = { status: err.status, reason: err.reason, next: err.next, ...err.extra };
    const text = [err.reason, ...err.next.map((n) => `다음: ${n}`)].join("\n");
    return {
      code: EXIT[err.status],
      stdout: json ? `${JSON.stringify(body)}\n` : "",
      stderr: `${text}\n`,
    };
  }
}

// npm 전역 설치는 bin 을 심볼릭 링크로 걸어서 실제 경로로 비교한다
const isMain = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (isMain) {
  const out = run(process.argv.slice(2));
  process.stdout.write(out.stdout);
  process.stderr.write(out.stderr);
  process.exitCode = out.code;
}

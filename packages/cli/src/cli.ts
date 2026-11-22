#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { findProduct } from "./find.js";
import { inspect as inspectDir } from "./inspect.js";
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
  options: {},
  run(_values, _positionals, ctx) {
    const found = findProduct(ctx.cwd);
    if (!found) {
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
    return { productDir: found.productDir, mode: settings.mode, root: settings.root };
  },
};

const inspect: Command = {
  options: {},
  run(_values, _positionals, ctx) {
    return { ...inspectDir(ctx.cwd) };
  },
};

// 하위 명령은 여기에 더한다
const COMMANDS: Record<string, Command> = { root, inspect };

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
    return {
      code: EXIT.ok,
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

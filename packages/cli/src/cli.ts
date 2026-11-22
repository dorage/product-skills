#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { findProduct } from "./find.js";

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
type Command = (args: string[], ctx: { cwd: string }) => Result;

function root(_args: string[], ctx: { cwd: string }): Result {
  const found = findProduct(ctx.cwd);
  if (!found) {
    throw new CliError("notFound", `${ctx.cwd} 에서 위로 올라가도 .product/ 가 없다`, [
      "/product:setup",
    ]);
  }
  return { productDir: found.productDir };
}

// 하위 명령은 여기에 더한다
const COMMANDS: Record<string, Command> = { root };

const human = (r: Result): string =>
  Object.entries(r)
    .filter(([k]) => k !== "status")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

export function run(argv: string[], cwd: string = process.cwd()): Output {
  let json = false;
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        json: { type: "boolean" },
        version: { type: "boolean" },
      },
      allowPositionals: true,
      strict: false,
    });
    json = values.json === true;
    if (values.version === true && positionals.length === 0) {
      return { code: EXIT.ok, stdout: `${VERSION}\n`, stderr: "" };
    }
    const [name, ...rest] = positionals;
    const cmd = name ? COMMANDS[name] : undefined;
    if (!cmd) {
      throw new CliError("error", `모르는 명령: ${name ?? "(없음)"}`, [
        `product ${Object.keys(COMMANDS).join("|")} [--json]`,
      ]);
    }
    const result = { status: "ok", ...cmd(rest, { cwd }) };
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

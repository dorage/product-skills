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
  // 출력과 같은 내용의 결과. 터미널 질문 갈래가 need 를 읽는다
  body: Record<string, unknown>;
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
    .filter(([k, v]) => k !== "status" || v !== "ok")
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
      if (values.version === true) {
        return { code: EXIT.ok, stdout: `${VERSION}\n`, stderr: "", body: { status: "ok", version: VERSION } };
      }
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
      body: result,
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
      body,
    };
  }
}

// 요구사항 5 인수 조건 7: 터미널에서 옵션 없이 부르면 빠진 답을 묻고 옵션으로 붙여 다시 부른다.
// 표준 입력이 터미널이 아니면 묻지 않고 need 를 그대로 낸다 (E24)
type Ask = (question: string) => Promise<string>;

const yes = (a: string) => /^(y|yes|예|네|ㅇ)$/i.test(a.trim());

async function answer(need: string, body: Record<string, unknown>, ask: Ask): Promise<string[] | null> {
  switch (need) {
    case "mode": {
      for (;;) {
        const a = (
          await ask(
            "셋업 방식을 고르세요\n  external: 지금 폴더를 product 루트로 삼고 리포를 repos/ 아래 submodule 로 더한다\n  internal: 이 리포 안에 .product/ 를 만들어 커밋한다\n(external/internal): ",
          )
        ).trim();
        if (a === "external" || a === "internal") return ["--mode", a];
      }
    }
    case "repo": {
      const repos: string[] = [];
      for (;;) {
        const a = (await ask(repos.length ? "리포 주소 (빈 줄이면 끝): " : "리포 주소: ")).trim();
        if (a) repos.push(a);
        else if (repos.length) return repos.flatMap((r) => ["--repo", r]);
      }
    }
    case "at": {
      for (;;) {
        const a = (await ask(`리포 맨 위(${String(body.top)})와 지금 폴더 중 어디에 .product/ 를 만들까요 (top/here): `)).trim();
        if (a === "top" || a === "here") return ["--at", a];
      }
    }
    case "use-existing-repo":
      return yes(await ask("이 리포를 product 루트로 쓸까요 (y/N): ")) ? ["--use-existing-repo"] : null;
    case "allow-nested":
      return yes(await ask(`위쪽에 product 폴더 ${String(body.ancestor)} 가 있습니다. 그래도 여기에 셋업할까요 (y/N): `))
        ? ["--allow-nested"]
        : null;
    default:
      return null;
  }
}

export async function runInteractive(argv: string[], cwd: string, isTTY: boolean, ask: Ask): Promise<Output> {
  let args = argv;
  for (let round = 0; round < 10; round++) {
    const out = run(args, cwd);
    const need = out.body.need;
    if (out.code !== EXIT.need || !isTTY || !Array.isArray(need)) return out;
    if (typeof out.body.reason === "string") process.stderr.write(`${out.body.reason}\n`);
    for (const n of need as string[]) {
      const extra = await answer(n, out.body, ask);
      if (extra === null) {
        const body = { status: "stopped", reason: "셋업을 하지 않았다", next: [] };
        return { code: EXIT.stopped, stdout: "", stderr: "셋업을 하지 않았다\n", body };
      }
      args = [...args, ...extra];
    }
  }
  return run(args, cwd);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const isTTY = process.stdin.isTTY === true;
  let out: Output;
  if (isTTY) {
    const { createInterface } = await import("node:readline/promises");
    // 질문 하나마다 열고 닫는다. 열어 둔 채 git 을 돌리면 터미널이 raw 모드로 남아
    // Ctrl-C 와 git 의 비밀번호 질문이 먹지 않는다
    const ask: Ask = async (q) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await rl.question(q);
      } finally {
        rl.close();
      }
    };
    out = await runInteractive(argv, process.cwd(), true, ask);
  } else {
    out = run(argv);
  }
  process.stdout.write(out.stdout);
  process.stderr.write(out.stderr);
  process.exitCode = out.code;
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
if (isMain) void main();

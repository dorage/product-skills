import { test } from "node:test";
import assert from "node:assert/strict";
import { atLeast } from "./version.js";
import { EXIT, run } from "./cli.js";

test("기대 버전과 같으면 통과", () => {
  assert.equal(atLeast("0.1.0", "0.1.0"), true);
});

test("셋째 자리가 하나 낮으면 실패", () => {
  assert.equal(atLeast("0.1.0", "0.1.1"), false);
});

test("자리마다 숫자로 비교한다 (0.10.0 > 0.9.0)", () => {
  assert.equal(atLeast("0.10.0", "0.9.0"), true);
  assert.equal(atLeast("0.9.0", "0.10.0"), false);
});

test("읽을 수 없는 버전 문자열은 오류", () => {
  assert.throws(() => atLeast("0.1.0", "0.1"), /버전/);
  assert.throws(() => atLeast("0.1.0-beta.1", "0.1.0"), /버전/);
  assert.throws(() => atLeast("0.1.0", "abc"), /버전/);
});

test("--expect 가 지금 버전보다 높으면 종료 코드 5", () => {
  const out = run(["root", "--json", "--expect", "99.0.0"]);
  assert.equal(out.code, EXIT.version);
  const body = JSON.parse(out.stdout);
  assert.equal(body.status, "version");
  assert.ok(Array.isArray(body.next));
});

test("--expect 가 지금 버전 이하면 그대로 명령을 실행한다", () => {
  const out = run(["--version", "--expect", "0.0.1"]);
  assert.equal(out.code, EXIT.ok);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { repoName } from "./repoName.js";

// 요구사항 2 「리포 이름」 표
test("ssh 주소 git@github.com:org/cafe-api.git → cafe-api", () => {
  assert.equal(repoName("git@github.com:org/cafe-api.git"), "cafe-api");
});

test("https 주소 https://github.com/org/cafe-web → cafe-web", () => {
  assert.equal(repoName("https://github.com/org/cafe-web"), "cafe-web");
});

test("다른 조직의 같은 이름 리포는 같은 이름이 나와 겹침을 알 수 있다", () => {
  assert.equal(repoName("git@github.com:other/cafe-api.git"), repoName("git@github.com:org/cafe-api.git"));
});

test("끝의 / 와 로컬 경로도 마지막 이름을 쓴다", () => {
  assert.equal(repoName("https://github.com/org/cafe-web.git/"), "cafe-web");
  assert.equal(repoName("/tmp/x/cafe-api.git"), "cafe-api");
  assert.equal(repoName("file:///tmp/x/cafe-api"), "cafe-api");
});

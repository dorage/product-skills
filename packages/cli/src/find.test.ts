import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProduct } from "./find.js";

const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), "product-find-")));

test("세 단계 위의 .product 를 찾는다", () => {
  const root = tmp();
  mkdirSync(join(root, ".product"));
  const start = join(root, "repos", "cafe-api", "src");
  mkdirSync(start, { recursive: true });
  assert.deepEqual(findProduct(start), {
    productDir: join(root, ".product"),
    settingsFile: join(root, ".product-settings"),
  });
});

test("위로 올라가도 .product 가 없으면 null", () => {
  const root = tmp();
  assert.equal(findProduct(root), null);
});

// 요구사항 4 「어디서 부르면 어느 product 폴더를 찾나」 8행. 행마다 임시 폴더를 따로 만든다
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: GIT_ENV, stdio: "pipe" }).toString();

const mkProduct = (dir: string) => {
  mkdirSync(join(dir, ".product"), { recursive: true });
  writeFileSync(join(dir, ".product", ".gitignore"), "_humanize/\n_workspace/\n.*.before\n");
};
const at = (work: string, p: string) => {
  mkdirSync(join(work, p), { recursive: true });
  return join(work, p);
};
const expectFound = (start: string, owner: string | null) =>
  assert.equal(findProduct(start)?.productDir ?? null, owner === null ? null : join(owner, ".product"));

// 내부 셋업 전의 shop 리포 (커밋 1개, .worktrees/ 는 무시)
const shopRepo = (work: string) => {
  const shop = at(work, "shop");
  git(shop, "init", "-q", "-b", "main");
  writeFileSync(join(shop, ".gitignore"), ".worktrees/\n");
  git(shop, "add", ".gitignore");
  git(shop, "commit", "-q", "-m", "init");
  return shop;
};
const internalSetup = (shop: string) => {
  mkProduct(shop);
  git(shop, "add", ".product/.gitignore");
  git(shop, "commit", "-q", "-m", "setup");
};

test("표 1행: ~/work/cafe/ → ~/work/cafe/.product/", () => {
  const work = tmp();
  const cafe = at(work, "cafe");
  mkProduct(cafe);
  expectFound(cafe, cafe);
});

test("표 2행: ~/work/cafe/repos/cafe-api/src/ → 세 단계 위 ~/work/cafe/.product/", () => {
  const work = tmp();
  const cafe = at(work, "cafe");
  mkProduct(cafe);
  expectFound(at(work, "cafe/repos/cafe-api/src"), cafe);
});

test("표 3행: cafe-api 도 내부 셋업했으면 더 가까운 cafe-api/.product/", () => {
  const work = tmp();
  mkProduct(at(work, "cafe"));
  const api = at(work, "cafe/repos/cafe-api");
  mkProduct(api);
  expectFound(api, api);
});

test("표 4행: shop 맨 위와 packages/api 둘 다 셋업했으면 더 가까운 packages/api/.product/", () => {
  const work = tmp();
  mkProduct(at(work, "shop"));
  const api = at(work, "shop/packages/api");
  mkProduct(api);
  expectFound(api, api);
});

test("표 5행: ~/work/shop/ → ~/work/shop/.product/", () => {
  const work = tmp();
  const shop = at(work, "shop");
  mkProduct(shop);
  expectFound(shop, shop);
});

test("표 6행: 내부 셋업 커밋 뒤에 만든 워크트리 → 워크트리 안 .product/", () => {
  const work = tmp();
  const shop = shopRepo(work);
  internalSetup(shop);
  git(shop, "worktree", "add", "-q", ".worktrees/feat-x");
  const wt = join(shop, ".worktrees/feat-x");
  expectFound(wt, wt);
});

test("표 7행: 내부 셋업보다 먼저 만든 워크트리 → 두 단계 위 메인 체크아웃 .product/", () => {
  const work = tmp();
  const shop = shopRepo(work);
  git(shop, "worktree", "add", "-q", ".worktrees/feat-x");
  internalSetup(shop);
  expectFound(join(shop, ".worktrees/feat-x"), shop);
});

test("표 8행: 셋업 안 한 ~/work/other/ → 없음", () => {
  const work = tmp();
  expectFound(at(work, "other"), null);
});

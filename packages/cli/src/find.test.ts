import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
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

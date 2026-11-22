import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface FoundProduct {
  productDir: string;
  settingsFile: string;
}

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// 시작 폴더에서 파일 시스템 맨 위까지 올라가며 .product/ 가 있는 가장 가까운 폴더를 찾는다
export function findProduct(from: string): FoundProduct | null {
  let dir = resolve(from);
  for (;;) {
    const productDir = join(dir, ".product");
    if (isDir(productDir)) {
      return { productDir, settingsFile: join(dir, ".product-settings") };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

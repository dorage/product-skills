import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_PRODUCT_DIR_NAME, readProductDirName, SETTINGS_FILE } from "./settings.js";

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

const isFile = (p: string): boolean => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

// 폴더 하나가 product 루트인지 본다.
// 설정 파일이 있으면 그 productDirName(없으면 .product)을 product 폴더로 본다. 설정 파일이 없으면 .product/ 가 있어야 한다
export function productAt(dir: string): FoundProduct | null {
  const settingsFile = join(dir, SETTINGS_FILE);
  if (isFile(settingsFile)) return { productDir: join(dir, readProductDirName(settingsFile)), settingsFile };
  const productDir = join(dir, DEFAULT_PRODUCT_DIR_NAME);
  return isDir(productDir) ? { productDir, settingsFile } : null;
}

// 시작 폴더에서 파일 시스템 맨 위까지 올라가며 가장 가까운 product 루트를 찾는다
export function findProduct(from: string): FoundProduct | null {
  let dir = resolve(from);
  for (;;) {
    const found = productAt(dir);
    if (found) return found;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

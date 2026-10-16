/**
 * Copies the ZXing-C++ WebAssembly decoder (used by the `barcode-detector`
 * polyfill) into public/ so it is served from our own origin — no runtime
 * dependency on a CDN, and it works on a shop's local network.
 * Runs on `npm install` (postinstall) and in the Vercel build.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const src = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
const destDir = path.resolve("public", "zxing");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, "zxing_reader.wasm"));
console.log("✔ Copied zxing_reader.wasm to public/zxing/");

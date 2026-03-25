#!/usr/bin/env node
/**
 * Build script for node reverse proxy (nrp).
 * This script compiles the TypeScript source files
 * to both CommonJS and ESModule formats.
 * The package keeps dependencies to a minimum.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const DIST = path.join(ROOT, 'dist');
/**
 * Executes a shell command synchronously in the root directory of the project.
 * @param {*} cmd  The command to execute.
 */
const run = (cmd) => {
  console.info(` $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}
/**
 * Recursively walks through a directory and applies a function to each file.
 * @param {*} dir  The directory to walk through.
 * @param {*} f  The function to apply to each file.
 */
const walk = (dir, f) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    e.isDirectory() ? walk(full, f) : f(full);
  }
}
/**
 * Copies all files from the source directory to the destination directory, preserving the directory structure.
 * @param {*} src  The source directory to copy files from.
 * @param {*} dest  The destination directory to copy files to.
 */
const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  walk(src, (file) => {
    const rel = path.relative(src, file);
    const destFile = path.join(dest, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(file, destFile);
  });
}
/**
 * Prepends a shebang line to the given file if it doesn't already have one.
 * @param {*} file  The file to prepend the shebang to.
 */
const prependShebang = (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  if (!content.startsWith('#!')) {
    fs.writeFileSync(file, `#!/usr/bin/env node\n${content}`);
  }
}

/**
 * Converts CommonJS JavaScript files to ESModule format by renaming `.js` files to `.mjs`
 * and updating import/export statements accordingly.
 * @param {*} dir  The directory containing the CommonJS files to convert to ESModule format.
 */
const esmify = (dir) => {
  // first pass
  const renames = new Map();
  walk(dir, (file) => {
    if (file.endsWith('.js')) {
      const esmFile = file.replace(/\.js$/, '.mjs');
      renames.set(file, esmFile);
    }
  });

  // second pass
  walk(dir, (file) => {
    if (!file.endsWith('.mjs') && !file.endsWith('.d.ts')) return;
    let src = fs.readFileSync(file, 'utf-8');
    src = src.replace(/(from\s+["'])(\.{1,2}\/[^"']+?)\.js("'])/g, "$1$2.mjs$3");
    src = src.replace(/(export\s+.*?from\s+["'])(\.{1,2}\/[^"']+?)\.js(["'])/g, "$1$2.mjs$3");
    src = src.replace(/\/\/# sourceMappingURL=(.+?)\.js\.map/, "//# sourceMappingURL=$1.mjs.map");
    fs.writeFileSync(file, src);
  })
}

/**
 * Cleans the dist directory and builds the project in both ESM and CJS formats.
 */
console.log("\n▶ Cleaning dist/");
fs.rmSync(DIST, { recursive: true, force: true });

console.log("\n▶ Building ESM (tsc → dist/esm/)");
run("npx tsc --project tsconfig.json --outDir dist/esm");
esmify(path.join(DIST, "esm"));

// Flatten ESM output to dist/ root
console.log("\n▶ Copying ESM surface → dist/");
copyDir(path.join(DIST, "esm"), DIST);
fs.rmSync(path.join(DIST, "esm"), { recursive: true, force: true });

console.log("\n▶ Building CJS (tsc → dist/cjs/)");
run("npx tsc --project tsconfig.cjs.json");

// Mark the CJS subtree so Node resolves it correctly
fs.writeFileSync(
  path.join(DIST, "cjs", "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
);

const candidates = [
  path.join(DIST, "cli", "index.mjs"),
  path.join(DIST, "cli", "index.js"),
  path.join(DIST, "cjs", "cli", "index.js"),
];
for (const f of candidates) {
  if (fs.existsSync(f)) {
    console.log(`\n▶ Prepending shebang → ${path.relative(ROOT, f)}`);
    prependShebang(f);
  }
}

console.log("\n✓ Build complete\n");
const report = [
  "dist/index.mjs",
  "dist/index.d.ts",
  "dist/cli/index.mjs",
  "dist/cjs/index.js",
  "dist/cjs/cli/index.js",
];
for (const f of report) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) {
    const kb = (fs.statSync(full).size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(32)} ${kb} kB`);
  }
}
console.log();

#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { errorMessage } from "./lib/error-message.mjs";
import { readJson } from "./lib/json.mjs";

// cli/add/README.md shows the `diffgazer.json` that `dgadd init` writes, and
// init stamps the package version into it — so the example carries a literal
// version, pinned by cli/add/src/commands/init/readme.test.ts. `changeset
// version` bumps the manifest but not hand-written prose, which left a Version
// PR whose own CI was red. Rewriting the example here, inside
// `version-packages`, puts the bump into the same commit.
const README_PATH = "cli/add/README.md";
const MANIFEST_PATH = "cli/add/package.json";
const CONFIG_EXAMPLE_RE = /```json\n[\s\S]*?```/;
const VERSION_KEY_RE = /"version": "[^"]*"/;

export function syncReadmeVersion(readme, version) {
  const example = readme.match(CONFIG_EXAMPLE_RE);
  if (!example || !VERSION_KEY_RE.test(example[0])) {
    throw new Error(`${README_PATH}: no json config example with a "version" key`);
  }
  const synced = example[0].replace(VERSION_KEY_RE, `"version": "${version}"`);
  return readme.slice(0, example.index) + synced + readme.slice(example.index + example[0].length);
}

function main() {
  const { version } = readJson(MANIFEST_PATH);
  const readme = readFileSync(README_PATH, "utf8");
  const synced = syncReadmeVersion(readme, version);
  if (synced === readme) return;
  writeFileSync(README_PATH, synced);
  console.log(`${README_PATH}: config example now pins ${version}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { syncReadmeVersion } from "./sync-add-readme-version.mjs";

const readme = [
  "## Configuration",
  "",
  "```json",
  "{",
  '  "$schema": "https://r.b4r7.dev/schema/diffgazer.json",',
  '  "version": "0.1.1",',
  '  "rsc": false',
  "}",
  "```",
  "",
  '`version` is the `dgadd` version that wrote the file. Set `"version": "x"` by hand and it is ignored.',
  "",
  "```json",
  '{ "version": "0.1.1" }',
  "```",
  "",
].join("\n");

test("rewrites the version inside the first json example only", () => {
  const synced = syncReadmeVersion(readme, "0.2.0");

  assert.equal(synced, readme.replace('  "version": "0.1.1",', '  "version": "0.2.0",'));
});

test("is a no-op when the example already pins the manifest version", () => {
  assert.equal(syncReadmeVersion(readme, "0.1.1"), readme);
});

test("fails when the README has no json example with a version key", () => {
  assert.throws(
    () => syncReadmeVersion("# no example\n", "0.2.0"),
    /no json config example with a "version" key/,
  );
  assert.throws(
    () => syncReadmeVersion('```json\n{ "rsc": false }\n```\n', "0.2.0"),
    /no json config example with a "version" key/,
  );
});

// The pin readme.test.ts enforces after merge holds at HEAD only because the
// README was fixed by hand; from now on version-packages keeps it true.
test("the committed cli/add README already pins its manifest version", () => {
  const root = new URL("../../", import.meta.url);
  const { version } = JSON.parse(readFileSync(new URL("cli/add/package.json", root), "utf8"));
  const committed = readFileSync(fileURLToPath(new URL("cli/add/README.md", root)), "utf8");

  assert.equal(syncReadmeVersion(committed, version), committed);
});

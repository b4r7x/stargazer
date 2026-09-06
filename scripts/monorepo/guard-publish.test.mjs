import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createPublishPlan, isPublicPackage } from "./guard-publish.mjs";

const packageFixtures = [
  { name: "diffgazer", version: "0.1.4", file: "cli/diffgazer/package.json" },
  { name: "@diffgazer/add", version: "0.1.1", file: "cli/add/package.json" },
  { name: "@diffgazer/ui", version: "0.1.0", file: "libs/ui/package.json" },
  { name: "@diffgazer/keys", version: "0.1.0", file: "libs/keys/package.json" },
];
const publishedVersionsByName = {
  diffgazer: ["0.1.3"],
  "@diffgazer/add": [],
  "@diffgazer/ui": [],
  "@diffgazer/keys": [],
};
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runPublisherChild({
  allowlist,
  candidateNames,
  registryVersions = publishedVersionsByName,
  existingTags = [],
  pnpmExitCodes = [0],
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "diffgazer-publish-guard-"));
  temporaryDirectories.push(directory);
  writeFileSync(path.join(directory, "README.md"), "fixture\n");
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "fixture@example.test"]);
  runGit(directory, ["config", "user.name", "Fixture"]);
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "-m", "init"]);
  for (const tag of existingTags) {
    runGit(directory, ["tag", tag]);
  }
  const binDirectory = path.join(directory, "bin");
  const logFile = path.join(directory, "publish.log");
  const fakePnpm = path.join(binDirectory, "pnpm");
  mkdirSync(binDirectory);
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const previousInvocations = existsSync(process.env.PUBLISH_LOG)
  ? readFileSync(process.env.PUBLISH_LOG, "utf8").trim().split("\\n").filter(Boolean).length
  : 0;
appendFileSync(process.env.PUBLISH_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
const exitCodes = JSON.parse(process.env.PNPM_EXIT_CODES);
process.exit(exitCodes[previousInvocations] ?? 0);
`,
    { mode: 0o755 },
  );
  chmodSync(fakePnpm, 0o755);

  const moduleUrl = pathToFileURL(path.resolve("scripts/monorepo/guard-publish.mjs")).href;
  const input = {
    packages: packageFixtures,
    publishedVersions: registryVersions,
    allowlist,
    candidateNames,
  };
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { publishPendingPackages } from ${JSON.stringify(moduleUrl)};
const input = ${JSON.stringify(input)};
publishPendingPackages({
  ...input,
  publishedVersionsByName: new Map(Object.entries(input.publishedVersions)),
});`,
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_LOG: logFile,
        PNPM_EXIT_CODES: JSON.stringify(pnpmExitCodes),
      },
    },
  );
  const invocations = existsSync(logFile)
    ? readFileSync(logFile, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  const tags = spawnSync("git", ["tag", "-l"], { cwd: directory, encoding: "utf8" });
  assert.equal(tags.status, 0, tags.stderr);
  return {
    child,
    directory,
    invocations,
    tags: tags.stdout.trim().split("\n").filter(Boolean),
  };
}

function writeExecutable(file, source) {
  writeFileSync(file, `#!/usr/bin/env node\n${source}\n`, { mode: 0o755 });
  chmodSync(file, 0o755);
}

function runGit(directory, args) {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function writePackage(directory, file, name, version, isPrivate = false) {
  const packageFile = path.join(directory, file);
  mkdirSync(path.dirname(packageFile), { recursive: true });
  writeFileSync(packageFile, `${JSON.stringify({ name, version, private: isPrivate })}\n`);
}

// Two commits: the Version PR commit that bumps `versions`, then a later commit
// that touches no manifest — the ordinary push to main the guard runs on when
// the version commit's own CI never went green.
function createMainFixture({
  versions,
  registryVersions = publishedVersionsByName,
  extraManifests = [],
  existingTags = [],
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "diffgazer-publish-main-"));
  temporaryDirectories.push(directory);
  const binDirectory = path.join(directory, "bin");
  const publishLog = path.join(directory, "publish.log");
  mkdirSync(binDirectory);

  const manifests = [
    ["cli/diffgazer/package.json", "diffgazer", "0.1.3"],
    ["cli/add/package.json", "@diffgazer/add", "0.1.0"],
    ["libs/ui/package.json", "@diffgazer/ui", "0.1.0"],
    ["libs/keys/package.json", "@diffgazer/keys", "0.1.0"],
    ...extraManifests,
  ];
  writePackage(directory, "package.json", "fixture", "0.0.0", true);
  for (const [file, name, previousVersion] of manifests) {
    writePackage(directory, file, name, versions[name] ?? previousVersion);
  }
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "fixture@example.test"]);
  runGit(directory, ["config", "user.name", "Fixture"]);
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "-m", "version packages"]);
  for (const tag of existingTags) {
    runGit(directory, ["tag", tag]);
  }

  writeFileSync(path.join(directory, "README.md"), "fix the readme pin\n");
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "-m", "later green commit"]);

  writeExecutable(
    path.join(binDirectory, "npm"),
    `if (process.env.REGISTRY_ERROR) {
  console.error(process.env.REGISTRY_ERROR);
  process.exit(1);
}
const versions = JSON.parse(process.env.REGISTRY_VERSIONS);
const name = process.argv[3];
if (!(name in versions)) {
  console.error("E404 404 Not Found");
  process.exit(1);
}
process.stdout.write(JSON.stringify(versions[name]));`,
  );
  writeExecutable(
    path.join(binDirectory, "pnpm"),
    `require("node:fs").appendFileSync(
  process.env.PUBLISH_LOG,
  JSON.stringify(process.argv.slice(2)) + "\\n",
);`,
  );

  return {
    directory,
    binDirectory,
    publishLog,
    registryVersions: Object.fromEntries(
      Object.entries(registryVersions).filter(([, packageVersions]) => packageVersions.length > 0),
    ),
  };
}

function readInvocations(publishLog) {
  return existsSync(publishLog)
    ? readFileSync(publishLog, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
}

function runMainChild({ allowlist, versions, registryVersions = publishedVersionsByName }) {
  const {
    directory,
    binDirectory,
    publishLog,
    registryVersions: filteredRegistryVersions,
  } = createMainFixture({ versions, registryVersions });

  const moduleUrl = pathToFileURL(path.resolve("scripts/monorepo/guard-publish.mjs")).href;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { main } from ${JSON.stringify(moduleUrl)};
main({ allowlist: ${JSON.stringify(allowlist)}, requestedNames: [] });`,
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_LOG: publishLog,
        REGISTRY_VERSIONS: JSON.stringify(filteredRegistryVersions),
      },
    },
  );
  return { child, invocations: readInvocations(publishLog) };
}

function runDirectScriptChild({
  requestedNames,
  versions,
  registryVersions,
  registryError,
  extraManifests,
  existingTags,
}) {
  const {
    directory,
    binDirectory,
    publishLog,
    registryVersions: filteredRegistryVersions,
  } = createMainFixture({ versions, registryVersions, extraManifests, existingTags });

  const child = spawnSync(
    process.execPath,
    [path.resolve("scripts/monorepo/guard-publish.mjs"), ...requestedNames],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_LOG: publishLog,
        REGISTRY_VERSIONS: JSON.stringify(filteredRegistryVersions),
        REGISTRY_ERROR: registryError ?? "",
      },
    },
  );
  return { child, invocations: readInvocations(publishLog) };
}

test("plans a version as a publication when npm lacks it and as a tag when only git does", () => {
  const plan = createPublishPlan({
    packages: packageFixtures,
    publishedVersionsByName: new Map(
      Object.entries({ ...publishedVersionsByName, diffgazer: ["0.1.3", "0.1.4"] }),
    ),
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
    releaseTags: new Set(),
  });

  assert.deepEqual(
    plan.map((pkg) => [pkg.name, pkg.publication]),
    [
      ["diffgazer", "tag"],
      ["@diffgazer/add", "publish"],
    ],
  );
});

test("a version that is on npm and tagged drops out of the plan", () => {
  const plan = createPublishPlan({
    packages: packageFixtures,
    publishedVersionsByName: new Map(
      Object.entries({ ...publishedVersionsByName, diffgazer: ["0.1.3", "0.1.4"] }),
    ),
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
    releaseTags: new Set(["diffgazer@0.1.4"]),
  });

  assert.deepEqual(
    plan.map((pkg) => [pkg.name, pkg.publication]),
    [["@diffgazer/add", "publish"]],
  );
});

test("a gated package among the candidates fails before publication", () => {
  assert.throws(
    () =>
      createPublishPlan({
        packages: packageFixtures,
        publishedVersionsByName: new Map(Object.entries(publishedVersionsByName)),
        allowlist: ["diffgazer"],
        candidateNames: ["@diffgazer/add"],
        releaseTags: new Set(),
      }),
    /refusing to first-publish gated packages: @diffgazer\/add/,
  );
});

test("the gated-package rejection names the publishable subset to pass explicitly", () => {
  assert.throws(
    () =>
      createPublishPlan({
        packages: packageFixtures,
        publishedVersionsByName: new Map(Object.entries(publishedVersionsByName)),
        allowlist: ["diffgazer"],
        candidateNames: ["diffgazer", "@diffgazer/ui", "@diffgazer/keys"],
        releaseTags: new Set(),
      }),
    /pnpm run release diffgazer$/m,
  );
});

// A bare run considers every public package, so a never-published one outside
// the allowlist blocks the whole run rather than being skipped as "not versioned
// by this commit".
test("a bare run refuses a never-published package outside the allowlist before pnpm starts", () => {
  const { child, invocations } = runMainChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    versions: { "@diffgazer/add": "0.1.1" },
  });

  assert.notEqual(child.status, 0);
  assert.match(
    child.stderr,
    /refusing to first-publish gated packages: @diffgazer\/keys, @diffgazer\/ui/,
  );
  assert.deepEqual(invocations, []);
});

test("an explicit subset publishes only the named packages", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: ["@diffgazer/ui", "@diffgazer/keys"],
    versions: { "@diffgazer/ui": "0.1.1", "@diffgazer/keys": "0.1.1" },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, [
    ["--filter", "@diffgazer/keys", "publish", "--no-git-checks", "--provenance"],
    ["--filter", "@diffgazer/ui", "publish", "--no-git-checks", "--provenance"],
  ]);
});

// The shipped allowlist names every release-managed package, so the gate it
// still enforces is against a public package nobody added to it.
test("invoking the guard script directly refuses to first-publish a package outside the shipped allowlist", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: ["@diffgazer/extra"],
    versions: { "@diffgazer/extra": "0.1.1" },
    extraManifests: [["libs/extra/package.json", "@diffgazer/extra", "0.1.0"]],
  });

  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /refusing to first-publish gated packages: @diffgazer\/extra/);
  assert.deepEqual(invocations, []);
});

// The Version PR commit's own CI can fail for a reason a later commit fixes
// (a README pinned to the package version, say). The guard runs on that later
// commit and publishes whatever npm still lacks; the commit that happened to be
// green does not decide the set.
test("a later green commit publishes the versions the version commit left unpublished", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: [],
    versions: {
      diffgazer: "0.2.0",
      "@diffgazer/add": "0.2.0",
      "@diffgazer/ui": "0.3.0",
      "@diffgazer/keys": "0.3.0",
    },
    registryVersions: { ...publishedVersionsByName, diffgazer: ["0.1.1", "0.1.2", "0.1.3"] },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations.map((invocation) => invocation[1]).sort(), [
    "@diffgazer/add",
    "@diffgazer/keys",
    "@diffgazer/ui",
    "diffgazer",
  ]);
  assert.deepEqual(child.stdout.match(/^New tag: .+$/gm)?.sort(), [
    "New tag: @diffgazer/add@0.2.0",
    "New tag: @diffgazer/keys@0.3.0",
    "New tag: @diffgazer/ui@0.3.0",
    "New tag: diffgazer@0.2.0",
  ]);
});

test("a bare run after a complete release publishes and announces nothing", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: [],
    versions: { diffgazer: "0.1.4", "@diffgazer/add": "0.1.1" },
    registryVersions: {
      diffgazer: ["0.1.3", "0.1.4"],
      "@diffgazer/add": ["0.1.1"],
      "@diffgazer/ui": ["0.1.0"],
      "@diffgazer/keys": ["0.1.0"],
    },
    existingTags: [
      "diffgazer@0.1.4",
      "@diffgazer/add@0.1.1",
      "@diffgazer/ui@0.1.0",
      "@diffgazer/keys@0.1.0",
    ],
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, []);
  assert.doesNotMatch(child.stdout, /^New tag:/m);
  assert.match(child.stdout, /no eligible package versions need publication/);
});

// Only an E404 means "never published". Any other registry failure (DNS, a 5xx,
// auth) says nothing about what npm holds, so reading it as "absent" would
// publish on a guess; the run stops before pnpm starts, with npm's own stderr.
test("a registry error other than E404 stops the run before any publish", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: [],
    versions: { diffgazer: "0.2.0", "@diffgazer/add": "0.2.0" },
    registryError:
      "npm error code ENOTFOUND\nnpm error network request to https://registry.npmjs.org/ failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
  });

  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /npm view \S+ failed \(not an E404\)/);
  assert.match(child.stderr, /getaddrinfo ENOTFOUND registry\.npmjs\.org/);
  assert.deepEqual(invocations, []);
});

test("reports successfully published versions in the changesets action tag format", () => {
  const { child, directory, tags } = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(child.stdout.match(/^New tag: .+$/gm), [
    "New tag: diffgazer@0.1.4",
    "New tag: @diffgazer/add@0.1.1",
  ]);
  assert.deepEqual(tags.sort(), ["@diffgazer/add@0.1.1", "diffgazer@0.1.4"].sort());

  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" });
  assert.equal(head.status, 0, head.stderr);
  for (const tag of tags) {
    const taggedCommit = spawnSync("git", ["rev-parse", `${tag}^{commit}`], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(taggedCommit.status, 0, taggedCommit.stderr);
    assert.equal(taggedCommit.stdout.trim(), head.stdout.trim());
  }
});

test("creates release tags for already published versions without republishing", () => {
  const { child, invocations, tags } = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
    registryVersions: {
      ...publishedVersionsByName,
      diffgazer: ["0.1.3", "0.1.4"],
    },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, [
    ["--filter", "@diffgazer/add", "publish", "--no-git-checks", "--provenance"],
  ]);
  assert.deepEqual(tags.sort(), ["@diffgazer/add@0.1.1", "diffgazer@0.1.4"].sort());
});

test("recovers a partial publication without republishing the completed package", () => {
  const firstAttempt = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
    pnpmExitCodes: [0, 1],
  });

  assert.notEqual(firstAttempt.child.status, 0);
  assert.deepEqual(firstAttempt.invocations, [
    ["--filter", "diffgazer", "publish", "--no-git-checks", "--provenance"],
    ["--filter", "@diffgazer/add", "publish", "--no-git-checks", "--provenance"],
  ]);
  assert.doesNotMatch(firstAttempt.child.stdout, /^New tag:/m);

  const retry = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    candidateNames: ["diffgazer", "@diffgazer/add"],
    registryVersions: {
      ...publishedVersionsByName,
      diffgazer: ["0.1.3", "0.1.4"],
    },
  });

  assert.equal(retry.child.status, 0, retry.child.stderr);
  assert.deepEqual(retry.invocations, [
    ["--filter", "@diffgazer/add", "publish", "--no-git-checks", "--provenance"],
  ]);
  assert.deepEqual(retry.child.stdout.match(/^New tag: .+$/gm), [
    "New tag: diffgazer@0.1.4",
    "New tag: @diffgazer/add@0.1.1",
  ]);
});

// changesets/action turns every `New tag:` line into a pushed tag and a
// GitHub Release. A version that is live on npm and already tagged must not be
// announced again: that asks GitHub for a release that already exists.
test("a published version whose tag exists is skipped silently", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: ["diffgazer"],
    versions: {},
    registryVersions: { ...publishedVersionsByName, diffgazer: ["0.1.3"] },
    existingTags: ["diffgazer@0.1.3"],
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, []);
  assert.doesNotMatch(child.stdout, /^New tag:/m);
});

test("a published version whose tag is missing is announced without republishing", () => {
  const { child, invocations } = runDirectScriptChild({
    requestedNames: ["diffgazer"],
    versions: { diffgazer: "0.1.4" },
    registryVersions: { ...publishedVersionsByName, diffgazer: ["0.1.3", "0.1.4"] },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, []);
  assert.deepEqual(child.stdout.match(/^New tag: .+$/gm), ["New tag: diffgazer@0.1.4"]);
});

test("does not report a tag when an unpublished package fails", () => {
  const { child } = runPublisherChild({
    allowlist: ["@diffgazer/add"],
    candidateNames: ["@diffgazer/add"],
    pnpmExitCodes: [1],
  });

  assert.notEqual(child.status, 0);
  assert.doesNotMatch(child.stdout, /^New tag:/m);
});

test("private and unnamed packages are not public publish targets", () => {
  assert.equal(isPublicPackage({ name: "@diffgazer/core", private: true }), false);
  assert.equal(isPublicPackage({ private: true }), false);
  assert.equal(isPublicPackage({ name: undefined }), false);
  assert.equal(isPublicPackage({ name: "@diffgazer/ui" }), true);
});

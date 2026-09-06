#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { errorMessage } from "./lib/error-message.mjs";
import { isPackageManifestPath, listRepoFiles } from "./lib/files.mjs";
import { readJson } from "./lib/json.mjs";

// The publish set is decided by artifact state, not by the checked-out commit:
// every public package whose manifest version is absent from npm is published,
// and every published version without a `<name>@<version>` tag is announced.
// Deriving the set from what HEAD^..HEAD versioned tied publication to the
// Version PR commit's own CI run, which can fail for reasons a later commit
// fixes (a README pin, a flaky suite) — after which no commit ever "versioned"
// the stranded packages again. This rule is `changeset publish`'s, and it makes
// every green push to main and every retry idempotent.
//
// First-publish allowlist. All four release-managed packages are on npm and
// every one is listed, so the gate refuses only a never-published name outside
// this set (PACKAGE_GOVERNANCE.md, First-publish gate).
const FIRST_PUBLISH_ALLOWLIST = ["diffgazer", "@diffgazer/add", "@diffgazer/ui", "@diffgazer/keys"];

export function isPublicPackage(parsed) {
  return Boolean(parsed.name) && parsed.private !== true;
}

function listPublicPackages() {
  const packages = [];
  for (const file of listRepoFiles().filter(isPackageManifestPath)) {
    const parsed = readJson(file);
    if (!isPublicPackage(parsed)) continue;
    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error(`Public package ${parsed.name} in ${file} has no version`);
    }
    packages.push({ name: parsed.name, version: parsed.version, file });
  }
  return packages;
}

function getPublishedVersions(name) {
  let parsed;
  // Only the subprocess and the parse belong in the try: a shape error thrown
  // inside it would be re-wrapped as "npm view failed" even though npm exited 0.
  try {
    const output = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    parsed = JSON.parse(output);
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("E404") || stderr.includes("404 Not Found")) {
      return [];
    }
    if (error instanceof SyntaxError) {
      throw new Error(`npm view ${name} returned invalid JSON`, { cause: error });
    }
    throw new Error(`npm view ${name} failed (not an E404):\n${stderr || error.message}`);
  }

  if (typeof parsed === "string") return [parsed];
  if (Array.isArray(parsed) && parsed.every((version) => typeof version === "string")) {
    return parsed;
  }
  throw new Error(`npm view ${name} returned an invalid versions payload`);
}

function versionsFor(publishedVersionsByName, name) {
  return publishedVersionsByName.get(name) ?? [];
}

function releaseTag(pkg) {
  return `${pkg.name}@${pkg.version}`;
}

// The release checkout fetches every tag (fetch-depth: 0), so the local tag
// list mirrors origin at checkout time.
function listReleaseTags() {
  return new Set(
    execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).split("\n").filter(Boolean),
  );
}

export function createPublishPlan({
  packages,
  publishedVersionsByName,
  allowlist,
  candidateNames,
  releaseTags,
}) {
  const allowed = new Set(allowlist);
  const packagesByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const requested = new Set(candidateNames);
  const unknown = [...requested].filter((name) => !packagesByName.has(name));
  if (unknown.length > 0) {
    throw new Error(`Publish guard: unknown public package(s): ${unknown.join(", ")}`);
  }

  const candidates = packages.filter((pkg) => requested.has(pkg.name));
  const gated = candidates.filter(
    (pkg) => versionsFor(publishedVersionsByName, pkg.name).length === 0 && !allowed.has(pkg.name),
  );
  if (gated.length > 0) {
    const publishable = candidates.filter((pkg) => !gated.includes(pkg)).map((pkg) => pkg.name);
    const hint =
      publishable.length > 0
        ? ` To publish only the un-gated subset, name it: pnpm run release ${publishable.join(" ")}`
        : "";
    throw new Error(
      `Publish guard: refusing to first-publish gated packages: ${gated
        .map((pkg) => pkg.name)
        .join(", ")}.${hint}`,
    );
  }

  // `New tag:` is what changesets/action turns into a pushed Git tag and a
  // GitHub Release, so a version already live on npm is announced only while
  // its tag is missing — the retry of a partially failed run, or a later commit
  // finishing what the version commit's red CI left behind. Re-announcing a
  // tagged version would ask GitHub for a release that already exists.
  return candidates.flatMap((pkg) => {
    const published = versionsFor(publishedVersionsByName, pkg.name).includes(pkg.version);
    if (published && releaseTags.has(releaseTag(pkg))) return [];
    return [{ ...pkg, publication: published ? "tag" : "publish" }];
  });
}

export function publishPendingPackages({
  packages,
  publishedVersionsByName,
  allowlist = FIRST_PUBLISH_ALLOWLIST,
  candidateNames,
}) {
  const releaseTags = listReleaseTags();
  const plan = createPublishPlan({
    packages,
    publishedVersionsByName,
    allowlist,
    candidateNames,
    releaseTags,
  });

  if (plan.length === 0) {
    console.log("Publish guard: no eligible package versions need publication.");
    return [];
  }

  // `--provenance` is the one switch pnpm 11's native publish honours: it reads
  // neither `NPM_CONFIG_PROVENANCE` (v11 dropped every `npm_config_*` env) nor
  // `publishConfig.provenance` (npm's switch), and it only auto-attests when
  // npm's OIDC token exchange succeeds — which needs a trusted publisher, not a
  // token. @diffgazer/add@0.2.0 shipped without an attestation that way. With
  // the flag explicit, pnpm fails the publish instead of skipping when it
  // cannot sign (no `id-token: write`, a local shell).
  for (const pkg of plan) {
    if (pkg.publication === "tag") continue;
    execFileSync("pnpm", ["--filter", pkg.name, "publish", "--no-git-checks", "--provenance"], {
      stdio: "inherit",
    });
  }

  // Annotated tag at checkout HEAD; changesets/action pushes it via git after publish.
  for (const pkg of plan) {
    const tag = releaseTag(pkg);
    if (!releaseTags.has(tag)) {
      execFileSync("git", ["tag", "-a", tag, "-m", tag], { stdio: "inherit" });
    }
    console.log(`New tag: ${tag}`);
  }
  return plan.map((pkg) => pkg.name);
}

export function main({
  allowlist = FIRST_PUBLISH_ALLOWLIST,
  requestedNames = process.argv.slice(2),
} = {}) {
  const packages = listPublicPackages();
  const candidateNames =
    requestedNames.length > 0 ? requestedNames : packages.map((pkg) => pkg.name);
  const candidates = new Set(candidateNames);
  const publishedVersionsByName = new Map(
    packages
      .filter((pkg) => candidates.has(pkg.name))
      .map((pkg) => [pkg.name, getPublishedVersions(pkg.name)]),
  );

  return publishPendingPackages({
    packages,
    publishedVersionsByName,
    allowlist,
    candidateNames,
  });
}

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    main();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}

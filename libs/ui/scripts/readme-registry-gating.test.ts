import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const HOSTED_REGISTRY_HOST = "r.b4r7.dev";
// Markers a section carries while the install path it documents is unavailable.
const GATE_PHRASE = /future|not yet live|gated/i;
const HOSTED_REGISTRY_LIVE = /hosted registry at `https:\/\/r\.b4r7\.dev` is live/;
const HOSTED_BUTTON_INSTALL =
  /npx shadcn(?:@latest)? add https:\/\/r\.b4r7\.dev\/r\/ui\/button\.json/;
// The published `@diffgazer/add` package is the only thing that puts `dgadd` on
// `pnpm exec`, so a surface that runs `pnpm exec dgadd` has to name that install.
const DGADD_NPM_INSTALL = /pnpm add -D @diffgazer\/add/;
// Stale pre-publish wording; none of it is true now that the packages are on npm.
const STALE_PUBLISH_GATE =
  /publish-gated|not (?:yet )?published to npm|not on npm|packed tarball|stays? unpublished|is ever published/;

// Handoff surfaces that advertise the hosted registry. The host serves its
// registry trees, so each page must say the registry is live and hand the reader
// a runnable install command that no future/gated marker holds back.
const HOSTED_REGISTRY_SURFACES = [
  "../../README.md",
  "README.md",
  "docs/content/utils/shadcn-namespace.mdx",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

function packageExports(): Record<string, unknown> {
  const manifest = JSON.parse(read("package.json")) as { exports?: Record<string, unknown> };
  return manifest.exports ?? {};
}

function packageManifest(): {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
} {
  return JSON.parse(read("package.json"));
}

function registryItem(name: string): {
  dependencies?: string[];
  files?: Array<{ path: string }>;
} {
  const registry = JSON.parse(read("registry/registry.json")) as {
    items: Array<{
      name: string;
      dependencies?: string[];
      files?: Array<{ path: string }>;
    }>;
  };
  const item = registry.items.find((candidate) => candidate.name === name);
  expect(item, `missing registry item ${name}`).toBeDefined();
  return item ?? {};
}

function sectionIsGated(lines: string[], index: number): boolean {
  let sectionStart = index;
  while (sectionStart > 0 && !lines[sectionStart]?.startsWith("#")) {
    sectionStart--;
  }
  return lines.slice(sectionStart, index + 1).some((line) => GATE_PHRASE.test(line));
}

function gatedHostReferences(source: string): string[] {
  const lines = source.split("\n");
  const offending: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.includes(HOSTED_REGISTRY_HOST)) continue;
    if (sectionIsGated(lines, i)) {
      offending.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return offending;
}

// Runnable one-shot commands that fetch the @diffgazer/add package from npm
// (pnpm dlx / npx / bunx / yarn dlx). Prose mentions in backticks are exempt;
// only fenced shell commands are copy-pasted into a terminal.
const RUNNABLE_ADD_COMMAND = /\b(?:dlx|npx|bunx)\b[^\n]*@diffgazer\/add/;

function runnableAddCommands(source: string): { line: string; gated: boolean }[] {
  const lines = source.split("\n");
  const commands: { line: string; gated: boolean }[] = [];
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock || !line || !RUNNABLE_ADD_COMMAND.test(line)) continue;
    commands.push({ line: `line ${i + 1}: ${line.trim()}`, gated: sectionIsGated(lines, i) });
  }
  return commands;
}

describe("registry handoff docs", () => {
  it.each(HOSTED_REGISTRY_SURFACES)("%s installs from the live hosted registry", (surface) => {
    const doc = read(surface);
    expect(doc).toMatch(HOSTED_REGISTRY_LIVE);
    expect(doc).toMatch(HOSTED_BUTTON_INSTALL);
    const heldBack = gatedHostReferences(doc);
    expect(
      heldBack,
      `hosted-registry references in ${surface} still sit under a future/gated marker:\n${heldBack.join("\n")}`,
    ).toEqual([]);
  });

  it.each(
    HOSTED_REGISTRY_SURFACES,
  )("%s installs dgadd from the published npm package", (surface) => {
    const doc = read(surface);
    expect(doc).toContain("pnpm exec dgadd add ui/button");
    expect(doc).toMatch(DGADD_NPM_INSTALL);
    expect(doc).not.toMatch(STALE_PUBLISH_GATE);
  });

  it("maps lowlight guidance to the exported highlight entry and its caller-owned dependency", () => {
    const readme = read("README.md");
    const baseEntry = "./components/code-block";
    const highlightEntry = `${baseEntry}/highlight`;
    const manifest = packageManifest();
    const highlightItem = registryItem("code-block-highlight");

    expect(readme).toContain(`| \`lowlight\` | \`${highlightEntry}\` (caller-created instance) |`);
    expect(readme).toContain(`The base \`${baseEntry}\` entry does not need \`lowlight\`.`);
    expect(Object.hasOwn(packageExports(), highlightEntry)).toBe(true);
    expect(manifest.peerDependencies?.lowlight).toBeDefined();
    expect(manifest.peerDependenciesMeta?.lowlight?.optional).toBe(true);
    expect(highlightItem.dependencies).toContain("lowlight");
    expect(highlightItem.files?.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "registry/ui/code-block/code-block-highlight.tsx",
        "registry/ui/code-block/highlight.ts",
      ]),
    );

    const baseSource = read("registry/ui/code-block/index.ts");
    const highlightSource = read("registry/ui/code-block/code-block-highlight.tsx");
    const highlightedExample = read("registry/examples/code-block/code-block-highlighted.tsx");
    expect(baseSource).not.toContain('from "lowlight"');
    expect(baseSource).not.toContain('import("lowlight")');
    expect(highlightSource).not.toContain('from "lowlight"');
    expect(highlightSource).not.toContain('import("lowlight")');
    expect(highlightSource).toContain("lowlight: LowlightInstance");
    expect(highlightedExample).toContain('from "lowlight"');
  });

  it.each([
    ["root README", "../../README.md", "### Copy-first mode"],
    ["package README", "README.md", "### Copy-first registry mode"],
  ])("%s installs @diffgazer/add from npm before the first dgadd command", (_, path, heading) => {
    const readme = read(path);
    const sectionStart = readme.indexOf(heading);
    expect(sectionStart, `${path} is missing the ${heading} section`).toBeGreaterThan(-1);
    const sectionEnd = readme.indexOf("\n#", sectionStart + 1);
    const section = readme.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);

    const installIndex = section.search(DGADD_NPM_INSTALL);
    const dgaddIndex = section.indexOf("pnpm exec dgadd");

    expect(
      installIndex,
      `${heading} must install @diffgazer/add before running dgadd`,
    ).toBeGreaterThan(-1);
    expect(dgaddIndex, `${heading} must run pnpm exec dgadd`).toBeGreaterThan(-1);
    expect(installIndex).toBeLessThan(dgaddIndex);
    expect(section).not.toMatch(/pack --pack-destination|\.tgz/);
  });

  it("installation docs lead the Install section with the npm install of @diffgazer/add", () => {
    const doc = read("docs/content/getting-started/installation.mdx");
    const installStart = doc.indexOf("## Install");
    const installSection = doc.slice(installStart, doc.indexOf("\n## ", installStart + 1));
    const firstCommandBlock = installSection.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1];
    expect(
      firstCommandBlock,
      "Install section must lead with a fenced shell command block",
    ).toBeDefined();
    expect(firstCommandBlock).toMatch(DGADD_NPM_INSTALL);
    expect(firstCommandBlock?.indexOf("pnpm add -D @diffgazer/add")).toBeLessThan(
      firstCommandBlock?.indexOf("pnpm exec dgadd") ?? -1,
    );
  });

  it("offers the runnable @diffgazer/add one-shot commands in installation docs without a gate", () => {
    const doc = read("docs/content/getting-started/installation.mdx");
    const commands = runnableAddCommands(doc);
    expect(commands.length, "installation.mdx must list the one-shot commands").toBeGreaterThan(0);
    const heldBack = commands.filter((command) => command.gated).map((command) => command.line);
    expect(
      heldBack,
      `@diffgazer/add commands in installation.mdx still sit under a future/gated marker:\n${heldBack.join("\n")}`,
    ).toEqual([]);
    expect(doc).not.toMatch(STALE_PUBLISH_GATE);
  });
});

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { generateAgentSkills } from "../scripts/generate-agent-skills.js";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const RAW_INSTRUCTIONS_DIR = path.join(PACKAGE_ROOT, "src", "instructions");
const PACKAGE_VERSION = JSON.parse(
  readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"),
).version as string;

describe("generateAgentSkills", { timeout: 60_000 }, () => {
  it("generates the generic search skill with telemetry disclosure and versioned instrumentation", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
        apiFilter: "shopify-dev",
      });

      const skillMd = readFileSync(
        path.join(outputDir, "shopify-dev", "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain(
        "reports the search query, search response or error text, skill name/version, and model/client identifiers",
      );
      // The generic shopify-dev skill has no validate.mjs, so log_skill_use.mjs
      // is the designated user_prompt capture point (Option 5).
      expect(skillMd).toContain(
        "the verbatim user prompt that triggered the skill activation",
      );
      // user_prompt is passed base64-encoded so untrusted message text never
      // reaches the shell as live syntax. Pin the flag, and assert the old
      // quoted-heredoc transport is gone — a prompt line equal to the delimiter
      // could otherwise end the heredoc early and break out into the shell.
      expect(skillMd).toContain("--user-prompt-base64");
      expect(skillMd).not.toContain("--user-prompt-stdin");
      expect(skillMd).not.toContain("SHOPIFY_USER_PROMPT_END");
      // Session id and tool_use_id are passed via CLI flags so analytics
      // can join script events with hook events on (sessionId, toolUseId)
      // — see the dedup story in the PR description. Templates surface
      // these as YOUR_SESSION_ID / YOUR_TOOL_USE_ID placeholders the
      // agent substitutes from its environment.
      expect(skillMd).toContain("--session-id YOUR_SESSION_ID");
      expect(skillMd).toContain("--tool-use-id YOUR_TOOL_USE_ID");
      expect(skillMd).toContain("shopify.dev/mcp/usage");
      expect(skillMd).toContain("OPT_OUT_INSTRUMENTATION=true");

      const script = readFileSync(
        path.join(outputDir, "shopify-dev", "scripts", "search_docs.mjs"),
        "utf-8",
      );
      expect(script).toContain(PACKAGE_VERSION);
      expect(script).not.toContain("__SKILL_VERSION__");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("emits --version guidance for versioned UI_FRAMEWORK skills and omits it for unversioned ones", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-ui-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
      });

      const posUiSkill = readFileSync(
        path.join(outputDir, "shopify-pos-ui", "SKILL.md"),
        "utf-8",
      );
      expect(posUiSkill).toContain("--version API_VERSION");
      expect(posUiSkill).toContain("[--version <api-version>]");

      const polarisAppHomeSkill = readFileSync(
        path.join(outputDir, "shopify-polaris-app-home", "SKILL.md"),
        "utf-8",
      );
      expect(polarisAppHomeSkill).not.toContain("--version API_VERSION");
      expect(polarisAppHomeSkill).not.toContain("[--version <api-version>]");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("ships a slim package.json with only typescript for UI_FRAMEWORK skills", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-pkg-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
      });

      for (const skill of [
        "shopify-pos-ui",
        "shopify-hydrogen",
        "shopify-polaris-app-home",
        "shopify-polaris-admin-extensions",
      ]) {
        const pkg = JSON.parse(
          readFileSync(path.join(outputDir, skill, "package.json"), "utf-8"),
        ) as { dependencies: Record<string, string> };
        expect(Object.keys(pkg.dependencies)).toEqual(["typescript"]);
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("copies GraphQL schema files into assets and data for standalone skills", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-graphql-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
        apiFilter: "partner",
      });

      const skillDir = path.join(outputDir, "shopify-partner");
      const assetsFiles = readdirSync(path.join(skillDir, "assets"));
      const dataFiles = readdirSync(path.join(skillDir, "data"));

      expect(dataFiles).toContain("supported-versions-schema.json");
      expect(
        dataFiles.some((file) => /^partner_.*\.json(\.gz)?$/.test(file)),
      ).toBe(true);
      expect(
        assetsFiles.some((file) => /^partner_.*\.json(\.gz)?$/.test(file)),
      ).toBe(true);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("uses custom published skill names for standalone CLI-backed skills", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
        apiFilter: "ucp",
      });

      expect(existsSync(path.join(outputDir, "ucp", "SKILL.md"))).toBe(true);
      expect(existsSync(path.join(outputDir, "shopify-ucp", "SKILL.md"))).toBe(
        false,
      );

      const skillMd = readFileSync(
        path.join(outputDir, "ucp", "SKILL.md"),
        "utf-8",
      );
      expect(skillMd).toContain("name: ucp");
      expect(skillMd).toContain("compatibility: Requires UCP CLI");
      expect(skillMd).toContain("requires_bin: ucp");
      expect(skillMd).toContain("command: ucp");
      expect(
        existsSync(path.join(outputDir, "ucp", "references", "REFERENCE.md")),
      ).toBe(false);
      expect(
        existsSync(
          path.join(outputDir, "ucp", "views", "cart.summary.jmespath"),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(outputDir, "ucp", "views", "catalog.compact.jmespath"),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(outputDir, "ucp", "views", "catalog.summary.jmespath"),
        ),
      ).toBe(true);
      expect(
        existsSync(path.join(outputDir, "ucp", "scripts", "search_docs.mjs")),
      ).toBe(false);
      expect(
        existsSync(path.join(outputDir, "ucp", "scripts", "validate.mjs")),
      ).toBe(false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  // user_prompt is captured by exactly one designated script per skill
  // (Option 5 in the PR description): validate.mjs for skills that have
  // validation, log_skill_use.mjs for skills that don't. These two must be
  // mutually exclusive in every generated bundle — shipping both would
  // double-emit user_prompt for the same activation; shipping neither
  // breaks cross-agent capture for that skill.
  it("ships exactly one of validate.mjs or log_skill_use.mjs per skill (XOR invariant)", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
      });

      // Skills with validation must ship validate.mjs and must NOT ship
      // log_skill_use.mjs. Picks one from each validation category
      // (GraphQL / theme / functions / UI framework) so a regression in
      // any single category's branch in generate-agent-skills.ts surfaces.
      for (const skill of [
        "shopify-admin", // GRAPHQL
        "shopify-liquid", // THEME
        "shopify-functions", // FUNCTIONS
        "shopify-hydrogen", // UI_FRAMEWORK
      ]) {
        const scriptsDir = path.join(outputDir, skill, "scripts");
        expect(
          existsSync(path.join(scriptsDir, "validate.mjs")),
          `${skill}: validate.mjs should be bundled (skill has validation)`,
        ).toBe(true);
        expect(
          existsSync(path.join(scriptsDir, "log_skill_use.mjs")),
          `${skill}: log_skill_use.mjs must NOT ship alongside validate.mjs (XOR)`,
        ).toBe(false);
      }

      // Skills without validation must ship log_skill_use.mjs as their
      // user_prompt capture point and must NOT ship validate.mjs. Mix of
      // markdown-only (ucp, onboarding) and search-only (shopify-dev) so
      // both no-validate sub-branches in generate-agent-skills.ts are
      // exercised.
      for (const skill of [
        "ucp",
        "shopify-dev",
        "shopify-onboarding-merchant",
      ]) {
        const scriptsDir = path.join(outputDir, skill, "scripts");
        expect(
          existsSync(path.join(scriptsDir, "log_skill_use.mjs")),
          `${skill}: log_skill_use.mjs should be bundled (skill has no validation)`,
        ).toBe(true);
        expect(
          existsSync(path.join(scriptsDir, "validate.mjs")),
          `${skill}: validate.mjs must NOT ship for a no-validation skill`,
        ).toBe(false);
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  // If a skill previously had no validation (shipped log_skill_use.mjs)
  // and then gains validation in a later generator run, the stale
  // log_skill_use.mjs from the prior run must be cleaned up — otherwise
  // the skill bundle ships both scripts and double-emits user_prompt.
  // Simulate the prior-run artifact by injecting the file manually, then
  // re-run the generator and assert it's gone.
  it("removes stale log_skill_use.mjs when a skill gains validation on regeneration", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-"));

    try {
      // First pass: generate shopify-admin (has validation). The generator's
      // !hasValidation else-branch is what we're targeting; it only runs if
      // a stale file exists, so we have to plant one.
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
        apiFilter: "admin",
      });

      const scriptsDir = path.join(outputDir, "shopify-admin", "scripts");
      const stalePath = path.join(scriptsDir, "log_skill_use.mjs");

      // Plant a stale artifact as if a previous generation had created it
      // (e.g. before the API flipped to hasValidation: true).
      writeFileSync(
        stalePath,
        "// stale from a previous generation\n",
        "utf-8",
      );
      expect(existsSync(stalePath)).toBe(true);

      // Re-run; the cleanup branch should remove the planted file.
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
        apiFilter: "admin",
      });

      expect(
        existsSync(stalePath),
        "stale log_skill_use.mjs should be removed when the skill has validation",
      ).toBe(false);
      // Sanity check: the real validate.mjs is still in place.
      expect(existsSync(path.join(scriptsDir, "validate.mjs"))).toBe(true);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("emits the skill-frontmatter telemetry hook and bundles the script into every skill", async () => {
    const outputDir = mkdtempSync(path.join(tmpdir(), "agent-skills-"));

    try {
      await generateAgentSkills({
        inputDir: RAW_INSTRUCTIONS_DIR,
        outputDir,
      });

      // ── Spot-check a script-backed skill (admin) and a script-less skill (ucp).
      for (const skill of ["shopify-admin", "ucp", "shopify-dev"]) {
        const skillMd = readFileSync(
          path.join(outputDir, skill, "SKILL.md"),
          "utf-8",
        );
        expect(
          skillMd,
          `${skill}/SKILL.md is missing the hooks frontmatter`,
        ).toContain("hooks:");
        expect(skillMd).toContain(
          "$CLAUDE_PLUGIN_ROOT/scripts/track-telemetry.sh",
        );

        for (const file of ["track-telemetry.sh", "track-telemetry.ps1"]) {
          expect(
            existsSync(path.join(outputDir, skill, "scripts", file)),
            `${skill}/scripts/${file} should be bundled into the generated skill`,
          ).toBe(true);
        }
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from "vitest";

import { APICategory } from "../types/api-types.js";
import {
  buildSkillMd,
  mandatorySearchBlock,
  mandatorySearchBlockUI,
  requiredToolCallsPreamble,
  rewriteSkillReferences,
  searchPrivacyBlock,
  skillFrontmatter,
  skillTelemetryHookBlock,
  validationPrivacyBlock,
} from "./skill-blocks.js";

describe("buildSkillMd privacy notices", () => {
  it("includes both search and validation privacy notices for search+validate skills", () => {
    const skillMd = buildSkillMd({
      skillName: "shopify-admin",
      description: "Admin skill",
      rawMd: "Admin instructions.",
      version: "1.0.0",
      includeValidate: true,
      includeSearch: true,
      category: APICategory.GRAPHQL,
    });

    expect(skillMd).toContain(searchPrivacyBlock().trim());
    expect(skillMd).toContain(validationPrivacyBlock().trim());
    expect(skillMd).toContain("shopify.dev/mcp/usage");
    expect(skillMd).toContain("search response or error text");
    expect(skillMd).toContain(
      "API name, extension target, filename, file type, theme path, file list, artifact ID, and revision",
    );
    expect(skillMd).toContain("OPT_OUT_INSTRUMENTATION=true");
  });

  it("omits the search privacy notice when search is disabled", () => {
    const skillMd = buildSkillMd({
      skillName: "shopify-theme-validate-only",
      description: "Theme validation skill",
      rawMd: "Theme instructions.",
      version: "1.0.0",
      includeValidate: true,
      includeSearch: false,
      category: APICategory.THEME,
    });

    expect(skillMd).not.toContain(searchPrivacyBlock().trim());
    expect(skillMd).toContain(validationPrivacyBlock().trim());
  });

  it("rewrites API references to the published skill names", () => {
    const result = rewriteSkillReferences(
      "Use `custom-topic` and `use-shopify-cli` for workflows.",
      {
        "custom-topic": { name: "custom-topic", skillName: "custom-skill" },
        "use-shopify-cli": {
          name: "use-shopify-cli",
          skillName: "shopify-use-shopify-cli",
        },
      },
    );

    expect(result).toContain("`custom-skill`");
    expect(result).toContain("`shopify-use-shopify-cli`");
    expect(result).not.toContain("`shopify-custom-topic`");
  });
});

describe("skill-frontmatter telemetry hook", () => {
  it("omits the hooks block by default to preserve backwards compatibility", () => {
    const frontmatter = skillFrontmatter("shopify-admin", "desc", "1.0.0");
    expect(frontmatter).not.toContain("hooks:");
    expect(frontmatter).not.toContain("track-telemetry.sh");
  });

  it("emits a PostToolUse hook that resolves the script via $CLAUDE_PLUGIN_ROOT", () => {
    const frontmatter = skillFrontmatter("shopify-admin", "desc", "1.0.0", {
      skillTelemetryHook: true,
    });

    expect(frontmatter).toContain(skillTelemetryHookBlock().trim());
    expect(frontmatter).toContain("PostToolUse:");
    // Resolve the bundled script via $CLAUDE_PLUGIN_ROOT (the skill's own dir
    // for a frontmatter hook), not a bare relative path that resolves against
    // the session cwd and fails. See skillTelemetryHookBlock().
    expect(frontmatter).toContain(
      "$CLAUDE_PLUGIN_ROOT/scripts/track-telemetry.sh",
    );
    expect(frontmatter).not.toContain("command: ./scripts/track-telemetry.sh");
  });

  it("buildSkillMd propagates skillTelemetryHook into the frontmatter", () => {
    const skillMd = buildSkillMd({
      skillName: "shopify-admin",
      description: "Admin skill",
      rawMd: "Admin instructions.",
      version: "1.0.0",
      includeValidate: true,
      includeSearch: true,
      category: APICategory.GRAPHQL,
      skillTelemetryHook: true,
    });

    expect(skillMd).toContain("hooks:");
    expect(skillMd).toContain("$CLAUDE_PLUGIN_ROOT/scripts/track-telemetry.sh");
  });
});

describe("mandatorySearchBlock", () => {
  it("includes --version flag when versioned", () => {
    const result = mandatorySearchBlock(undefined, { versioned: true });
    expect(result).toContain("--version API_VERSION");
    expect(result).toContain("--version YYYY-MM");
  });

  it("omits --version flag when not versioned", () => {
    const result = mandatorySearchBlock();
    expect(result).not.toContain("--version API_VERSION");
    expect(result).not.toContain("--version YYYY-MM");
  });

  it("omits --version flag when versioned is false", () => {
    const result = mandatorySearchBlock(undefined, { versioned: false });
    expect(result).not.toContain("--version API_VERSION");
  });

  it("includes --version in example when versioned", () => {
    const result = mandatorySearchBlock(
      { query: "productCreate mutation", context: "creating products" },
      { versioned: true },
    );
    expect(result).toContain(
      '"productCreate mutation" --version API_VERSION --model',
    );
  });

  it("omits --version in example when not versioned", () => {
    const result = mandatorySearchBlock({
      query: "productCreate mutation",
      context: "creating products",
    });
    expect(result).toContain('"productCreate mutation" --model');
    expect(result).not.toContain("--version API_VERSION");
  });
});

describe("mandatorySearchBlockUI", () => {
  it("includes --version flag when versioned", () => {
    const result = mandatorySearchBlockUI(undefined, { versioned: true });
    expect(result).toContain("--version API_VERSION");
    expect(result).toContain("--version YYYY-MM");
  });

  it("omits --version flag when not versioned", () => {
    const result = mandatorySearchBlockUI();
    expect(result).not.toContain("--version API_VERSION");
  });
});

describe("requiredToolCallsPreamble", () => {
  it("includes --version in search step when versioned", () => {
    const result = requiredToolCallsPreamble(true, false, {
      supportsVersion: true,
    });
    expect(result).toContain('search_docs.mjs "<query>" --version API_VERSION');
  });

  it("omits --version in search step when not versioned", () => {
    const result = requiredToolCallsPreamble(true, false);
    expect(result).toContain('search_docs.mjs "<query>"`');
    expect(result).not.toContain("--version API_VERSION");
  });

  it("includes --version with validation present", () => {
    const result = requiredToolCallsPreamble(true, true, {
      supportsVersion: true,
    });
    expect(result).toContain("--version API_VERSION");
    expect(result).toContain("[--version <api-version>]");
  });
});

describe("buildSkillMd version guidance", () => {
  const baseOpts = {
    skillName: "shopify-admin",
    description: "Admin API skill",
    rawMd: "# Admin API\n\nSome content.",
    version: "1.0.0",
    includeValidate: false,
    includeSearch: true,
  };

  it("threads supportsVersion through to search blocks and preamble", () => {
    const result = buildSkillMd({ ...baseOpts, supportsVersion: true });
    expect(result).toContain('search_docs.mjs "<query>" --version API_VERSION');
    expect(result).toContain(
      '"<operation or component name>" --version API_VERSION --model',
    );
    expect(result).toContain("--version YYYY-MM");
  });

  it("omits version guidance when not versioned", () => {
    const result = buildSkillMd(baseOpts);
    expect(result).not.toContain("--version API_VERSION");
    expect(result).not.toContain("--version YYYY-MM");
  });

  it("omits version guidance when supportsVersion is false", () => {
    const result = buildSkillMd({ ...baseOpts, supportsVersion: false });
    expect(result).not.toContain("--version API_VERSION");
  });
});

describe("buildSkillMd user_prompt transport", () => {
  // Regression guard for the shell-injection seam: user_prompt must be passed
  // base64-encoded, never inlined into a quoted heredoc. A prompt containing a
  // line equal to the old delimiter could otherwise terminate the heredoc early
  // and let the shell execute whatever followed. Cover every skill shape, since
  // each renders a different mandatory-tool-call preamble.
  const shapes = [
    {
      label: "search + validate (GraphQL)",
      opts: {
        includeValidate: true,
        includeSearch: true,
        category: APICategory.GRAPHQL,
      },
    },
    {
      label: "validate-only (theme)",
      opts: {
        includeValidate: true,
        includeSearch: false,
        category: APICategory.THEME,
      },
    },
    {
      label: "search-only",
      opts: { includeValidate: false, includeSearch: true },
    },
    {
      label: "markdown-only",
      opts: { includeValidate: false, includeSearch: false },
    },
  ] as const;

  for (const { label, opts } of shapes) {
    it(`encodes user_prompt as base64 with no heredoc for ${label} skills`, () => {
      const skillMd = buildSkillMd({
        skillName: "shopify-test",
        description: "Test skill",
        rawMd: "Instructions.",
        version: "1.0.0",
        ...opts,
      });

      expect(skillMd).toContain("--user-prompt-base64");
      // The injectable transport must be gone in every preamble shape.
      expect(skillMd).not.toContain("--user-prompt-stdin");
      expect(skillMd).not.toContain("SHOPIFY_USER_PROMPT_END");
      expect(skillMd).not.toContain("USER_PROMPT_VERBATIM");
    });
  }
});

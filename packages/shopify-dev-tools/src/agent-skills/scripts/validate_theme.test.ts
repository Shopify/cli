import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");
const TSX_CLI = path.join(PACKAGE_ROOT, "node_modules/tsx/dist/cli.mjs");
const VALIDATE_THEME_SCRIPT = path.join(
  PACKAGE_ROOT,
  "src/agent-skills/scripts/validate_theme.ts",
);

type ValidateThemePayload = {
  success: boolean;
  responses: Array<{ result: string; resultDetail: string }>;
};

function runValidateTheme(args: string[]) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [TSX_CLI, VALIDATE_THEME_SCRIPT, "--json", ...args],
      {
        cwd: PACKAGE_ROOT,
        encoding: "utf-8",
        env: {
          ...process.env,
          SHOPIFY_DEV_INSTRUMENTATION_URL: "http://127.0.0.1:0",
          OPT_OUT_INSTRUMENTATION: "true",
        },
      },
    );
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    return {
      status: failure.status ?? 1,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
    };
  }
}

function payload(stdout: string): ValidateThemePayload {
  return JSON.parse(stdout) as ValidateThemePayload;
}

const APP_BLOCK = `<div {{ block.shopify_attributes }}>
  {{ app.metafields.reviews.rating.value }}
  {{ target.product.title }}
</div>

{% schema %}
{
  "name": "Rating stars",
  "target": "section",
  "javascript": "rating.js",
  "stylesheet": "rating.css",
  "settings": []
}
{% endschema %}`;

describe("validate_theme script", () => {
  it("validates theme app extension app blocks with app context", () => {
    const { status, stdout } = runValidateTheme([
      "--context",
      "app",
      "--filename",
      "rating.liquid",
      "--filetype",
      "blocks",
      "--code",
      APP_BLOCK,
    ]);

    expect(status).toBe(0);
    const result = payload(stdout);
    expect(result.success).toBe(true);
    expect(result.responses[0]?.result).not.toBe("failed");
    expect(result.responses[0]?.resultDetail).not.toContain(
      "Property target is not allowed",
    );
  });

  it("keeps theme context schema failures for app-block-only properties", () => {
    const { status, stdout } = runValidateTheme([
      "--context",
      "theme",
      "--filename",
      "rating.liquid",
      "--filetype",
      "blocks",
      "--code",
      APP_BLOCK,
    ]);

    expect(status).toBe(1);
    const result = payload(stdout);
    expect(result.success).toBe(false);
    expect(result.responses[0]?.resultDetail).toContain(
      "Property target is not allowed",
    );
  });

  it("validates doc tags in snippet context", () => {
    const snippet = `{% doc %}
  @description Renders a product card.
{% enddoc %}
<div>{{ product.title }}</div>`;

    const { status, stdout } = runValidateTheme([
      "--filename",
      "product-card.liquid",
      "--filetype",
      "snippets",
      "--code",
      snippet,
    ]);

    expect(status).toBe(0);
    expect(payload(stdout).success).toBe(true);
  });

  it("still fails invalid Liquid", () => {
    const { status, stdout } = runValidateTheme([
      "--filename",
      "broken.liquid",
      "--filetype",
      "snippets",
      "--code",
      "{% if product %}",
    ]);

    expect(status).toBe(1);
    const result = payload(stdout);
    expect(result.success).toBe(false);
    expect(result.responses[0]?.resultDetail).toContain(
      "Attempting to end parsing",
    );
  });
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");
const TSX_CLI = path.join(PACKAGE_ROOT, "node_modules/tsx/dist/cli.mjs");
const VALIDATE_FUNCTIONS_SCRIPT = path.join(
  PACKAGE_ROOT,
  "src/agent-skills/scripts/validate_functions.ts",
);

function runValidateFunctions(args: string[]) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [TSX_CLI, VALIDATE_FUNCTIONS_SCRIPT, ...args],
      {
        cwd: PACKAGE_ROOT,
        encoding: "utf-8",
        env: {
          ...process.env,
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

describe("validate_functions script", () => {
  it("emits structured JSON when --json is used with an unsupported version", () => {
    const { status, stdout, stderr } = runValidateFunctions([
      "--json",
      "--api",
      "functions_delivery_customization",
      "--version",
      "1900-01",
      "--code",
      "query Input { cart { deliveryGroups { deliveryOptions { handle } } } }",
    ]);

    expect(status).toBe(1);
    expect(stderr).toBe("");
    expect(stdout.trim()).not.toBe("");

    const payload = JSON.parse(stdout) as {
      success: boolean;
      responses: Array<{ result: string; resultDetail: string }>;
    };

    expect(payload.success).toBe(false);
    expect(payload.responses).toHaveLength(1);
    expect(payload.responses[0]?.result).toBe("failed");
    expect(payload.responses[0]?.resultDetail).toContain(
      "Version '1900-01' is not available for API 'functions_delivery_customization'.",
    );
    expect(payload.responses[0]?.resultDetail).toContain(
      "Available versions for 'functions_delivery_customization':",
    );
  });
});

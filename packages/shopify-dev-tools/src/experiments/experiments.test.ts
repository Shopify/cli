import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, vi } from "vitest";

import { Experiments, type ExperimentsVerdictClient } from "./experiments.js";
import { revokeInstallId } from "./install-id.js";

function makeVerdictClient(
  overrides: Partial<ExperimentsVerdictClient> = {},
): ExperimentsVerdictClient {
  return {
    assignVariant: vi.fn().mockResolvedValue("control"),
    flagEnabled: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("Experiments", () => {
  it("deactivates when SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS is set", () => {
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: { SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS: "1" },
    });

    expect(experiments.isActive).toBe(false);
    expect(experiments.optOutReason).toBe(
      "SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS set",
    );
    expect(experiments.debugSubjectId).toBeNull();
  });

  it("returns null/false without disk or network setup when opted out", async () => {
    const installIdProvider = vi.fn(() => "should-not-be-read");
    const verdictFactory = vi.fn(() => makeVerdictClient());
    const fetchImpl = vi.fn();
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: { CI: "true" },
      installIdProvider,
      verdictFactory,
      fetchImpl,
    });

    expect(experiments.isActive).toBe(false);
    expect(await experiments.assign("e_foo")).toBeNull();
    expect(await experiments.flag("f_foo")).toBe(false);
    expect(installIdProvider).not.toHaveBeenCalled();
    expect(verdictFactory).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("constructs with an install-id and becomes active when env is clean", () => {
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdOverride: "fixed-test-install-id",
      verdictFactory: () => makeVerdictClient(),
    });

    expect(experiments.isActive).toBe(true);
    expect(experiments.optOutReason).toBeUndefined();
    expect(experiments.debugSubjectId).toBe("fixed-test-install-id");
  });

  it("assigns experiments with the stable default subject", async () => {
    const verdictClient = makeVerdictClient({
      assignVariant: vi.fn().mockResolvedValue("treatment"),
    });
    const verdictFactory = vi.fn(() => verdictClient);
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdProvider: () => "install-abc",
      verdictFactory,
    });

    await expect(experiments.assign("e_foo")).resolves.toBe("treatment");
    expect(verdictFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "pub_test",
        appName: "dev-mcp-test",
        useEdgeApi: true,
        fetchOptions: { timeout: 2000 },
      }),
    );
    expect(verdictClient.assignVariant).toHaveBeenCalledWith("e_foo", {
      type: "default",
      subjectId: "install-abc",
    });
  });

  it("checks flags with the stable default subject", async () => {
    const verdictClient = makeVerdictClient({
      flagEnabled: vi.fn().mockResolvedValue(false),
    });
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdProvider: () => "install-abc",
      verdictFactory: () => verdictClient,
    });

    await expect(experiments.flag("f_foo")).resolves.toBe(false);
    expect(verdictClient.flagEnabled).toHaveBeenCalledWith("f_foo", {
      type: "default",
      subjectId: "install-abc",
    });
  });

  it("contains observer failures from Verdict onError", () => {
    const verdictError = new Error("verdict exploded");
    const onError = vi.fn(() => {
      throw new Error("observer failed");
    });
    let verdictOnError: ((err: unknown) => void) | undefined;

    new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdProvider: () => "install-abc",
      verdictFactory: (config) => {
        verdictOnError = config.onError as (err: unknown) => void;
        return makeVerdictClient();
      },
      onError,
    });

    expect(() => verdictOnError?.(verdictError)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(verdictError);
  });

  it("returns safe defaults and reports unexpected Verdict errors", async () => {
    const assignError = new Error("assign exploded");
    const flagError = new Error("flag exploded");
    const onError = vi.fn();
    const verdictClient = makeVerdictClient({
      assignVariant: vi.fn().mockRejectedValue(assignError),
      flagEnabled: vi.fn().mockRejectedValue(flagError),
    });
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdProvider: () => "install-abc",
      verdictFactory: () => verdictClient,
      onError,
    });

    await expect(experiments.assign("e_foo")).resolves.toBeNull();
    await expect(experiments.flag("f_foo")).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(assignError);
    expect(onError).toHaveBeenCalledWith(flagError);
  });

  it("keeps safe defaults when the error reporter throws", async () => {
    const verdictClient = makeVerdictClient({
      assignVariant: vi.fn().mockRejectedValue(new Error("assign exploded")),
      flagEnabled: vi.fn().mockRejectedValue(new Error("flag exploded")),
    });
    const experiments = new Experiments({
      apiKey: "pub_test",
      appName: "dev-mcp-test",
      env: {},
      installIdProvider: () => "install-abc",
      verdictFactory: () => verdictClient,
      onError: () => {
        throw new Error("observer failed");
      },
    });

    await expect(experiments.assign("e_foo")).resolves.toBeNull();
    await expect(experiments.flag("f_foo")).resolves.toBe(false);
  });

  it("threads config.env to getOrCreateInstallId so tests use a sandbox", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "experiments-env-test-"));
    const env = { XDG_STATE_HOME: sandbox };
    const verdictFactory = vi.fn(() => makeVerdictClient());

    try {
      const experiments = new Experiments({
        apiKey: "pub_test",
        appName: "dev-mcp-test",
        env,
        verdictFactory,
      });

      expect(experiments.isActive).toBe(true);
      const id = experiments.debugSubjectId;
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // Verify the ID was persisted in the sandbox, not the real home dir
      const persisted = readFileSync(
        join(sandbox, "shopify-ai-toolkit", "install-id"),
        "utf-8",
      );
      expect(persisted).toBe(id);
    } finally {
      revokeInstallId({ env });
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

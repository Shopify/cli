import { describe, it, expect } from "vitest";

import { detectOptOut } from "./opt-out.js";

describe("detectOptOut", () => {
  it("returns not opted out for empty env", () => {
    expect(detectOptOut({})).toEqual({ optedOut: false });
  });

  it.each([
    ["SHOPIFY_DEV_TOOLS_DISABLE_EXPERIMENTS", "1"],
    ["SHOPIFY_DEV_TOOLS_DISABLE_EXPERIMENTS", "true"],
    ["SHOPIFY_DEV_TOOLS_DISABLE_EXPERIMENTS", "TRUE"],
    ["SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS", "1"],
    ["SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS", "true"],
  ])("opts out when %s=%s", (name, value) => {
    const result = detectOptOut({ [name]: value });
    expect(result).toEqual({
      optedOut: true,
      reason: `${name} set`,
    });
  });

  it.each([
    "SHOPIFY_DEV_TOOLS_DISABLE_EXPERIMENTS",
    "SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS",
  ])("does not opt out for %s=0", (name) => {
    expect(detectOptOut({ [name]: "0" })).toEqual({
      optedOut: false,
    });
  });

  it("opts out when DO_NOT_TRACK=1", () => {
    expect(detectOptOut({ DO_NOT_TRACK: "1" })).toEqual({
      optedOut: true,
      reason: "DO_NOT_TRACK=1",
    });
  });

  it("opts out when DNT=1", () => {
    expect(detectOptOut({ DNT: "1" })).toEqual({
      optedOut: true,
      reason: "DNT=1",
    });
  });

  it.each([
    "CI",
    "CONTINUOUS_INTEGRATION",
    "GITHUB_ACTIONS",
    "BUILDKITE",
    "JENKINS_URL",
    "CIRCLECI",
    "GITLAB_CI",
    "TRAVIS",
  ])("opts out when %s is set", (name) => {
    const result = detectOptOut({ [name]: "anything-truthy" });
    expect(result).toEqual({
      optedOut: true,
      reason: `CI detected (${name})`,
    });
  });

  it("prefers explicit disable flag over CI detection", () => {
    const result = detectOptOut({
      SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS: "1",
      CI: "true",
    });
    expect(result.optedOut).toBe(true);
    if (result.optedOut) {
      expect(result.reason).toBe("SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS set");
    }
  });
});

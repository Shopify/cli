import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getOrCreateInstallId,
  resolveInstallIdDir,
  revokeInstallId,
} from "./install-id.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function installIdFile(sandbox: string): string {
  return join(sandbox, "shopify-ai-toolkit", "install-id");
}

describe("getOrCreateInstallId", () => {
  let sandbox: string;
  const originalXdg = process.env.XDG_STATE_HOME;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "install-id-test-"));
    process.env.XDG_STATE_HOME = sandbox;
  });

  afterEach(() => {
    revokeInstallId({ env: { XDG_STATE_HOME: sandbox } });
    if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = originalXdg;
  });

  it("creates a UUID on first call and persists it to disk", () => {
    const id = getOrCreateInstallId();
    expect(id).toMatch(UUID_PATTERN);
    expect(readFileSync(installIdFile(sandbox), "utf-8")).toBe(id);
  });

  it.skipIf(process.platform === "win32")(
    "writes the install-id file with 0o600 permissions",
    () => {
      getOrCreateInstallId();
      expect(statSync(installIdFile(sandbox)).mode & 0o777).toBe(0o600);
    },
  );

  it("returns the same id on repeat calls", () => {
    const first = getOrCreateInstallId();
    const second = getOrCreateInstallId();
    expect(second).toBe(first);
  });

  it("read-caches the id for the current process", () => {
    const first = getOrCreateInstallId();
    writeFileSync(installIdFile(sandbox), "different-id-on-disk");

    expect(getOrCreateInstallId()).toBe(first);
  });

  it("reads an existing id without overwriting it", () => {
    const dir = join(sandbox, "shopify-ai-toolkit");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "install-id"), "preexisting-id-value\n");

    expect(getOrCreateInstallId()).toBe("preexisting-id-value");
  });

  it("ignores whitespace-only files and regenerates", () => {
    const dir = join(sandbox, "shopify-ai-toolkit");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "install-id"), "   \n");

    const id = getOrCreateInstallId();
    expect(id).toMatch(UUID_PATTERN);
  });

  it("revokes the persisted id and clears the process cache", () => {
    const first = getOrCreateInstallId();

    expect(revokeInstallId()).toBe(true);
    expect(existsSync(installIdFile(sandbox))).toBe(false);

    const second = getOrCreateInstallId();
    expect(second).toMatch(UUID_PATTERN);
    expect(second).not.toBe(first);
    expect(readFileSync(installIdFile(sandbox), "utf-8")).toBe(second);
  });

  it("returns false when revoking an id that does not exist", () => {
    expect(revokeInstallId()).toBe(false);
  });
});

describe("resolveInstallIdDir", () => {
  it("prefers XDG_STATE_HOME when set, on any platform", () => {
    expect(resolveInstallIdDir({ XDG_STATE_HOME: "/xdg" }, "linux")).toMatch(
      /(^|[\\/])xdg[\\/]shopify-ai-toolkit$/,
    );
    expect(resolveInstallIdDir({ XDG_STATE_HOME: "/xdg" }, "darwin")).toMatch(
      /(^|[\\/])xdg[\\/]shopify-ai-toolkit$/,
    );
    expect(
      resolveInstallIdDir(
        { XDG_STATE_HOME: "C:\\xdg", LOCALAPPDATA: "C:\\AppData\\Local" },
        "win32",
      ),
    ).toMatch(/xdg[\\/]shopify-ai-toolkit$/);
  });

  it("uses %LOCALAPPDATA% on Windows when XDG_STATE_HOME is unset", () => {
    const dir = resolveInstallIdDir(
      { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" },
      "win32",
    );
    expect(dir).toMatch(/AppData[\\/]Local[\\/]shopify-ai-toolkit$/);
  });

  it("falls back to ~/.config on Unix when XDG_STATE_HOME is unset", () => {
    const dir = resolveInstallIdDir({}, "linux");
    expect(dir).toMatch(/\.config[\\/]shopify-ai-toolkit$/);
  });

  it("falls back to ~/.config on Windows when LOCALAPPDATA is missing", () => {
    const dir = resolveInstallIdDir({}, "win32");
    expect(dir).toMatch(/\.config[\\/]shopify-ai-toolkit$/);
  });
});

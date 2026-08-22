import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR_NAME = "shopify-ai-toolkit";
const FILE_NAME = "install-id";

export interface InstallIdOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

let cachedInstallId: { file: string; id: string } | undefined;

/**
 * Resolves the directory that holds the install-id file.
 *
 * Stable ID strategy:
 *   - Generate one random UUID per local machine/user profile on first active use.
 *   - Persist it under the OS-specific per-user state location so future processes
 *     get stable Verdict bucketing for the same install.
 *   - Never read or create this file while experiments are opted out.
 *   - Revoke by deleting the file with `revokeInstallId()`; the next active use
 *     creates a fresh UUID. Existing `Experiments` instances keep their in-memory
 *     subject, so recreate them after revocation. Revocation is local and cannot
 *     delete telemetry that was already emitted.
 *
 * Precedence:
 *   1. `XDG_STATE_HOME` — respected everywhere so tests (and Unix users who set it)
 *      can override the default.
 *   2. `%LOCALAPPDATA%` on Windows — the idiomatic per-user, non-roaming location.
 *   3. `~/.config/` — Unix fallback (works on Linux/macOS; matches gh, npm conventions).
 *
 * `env` and `platform` are injectable for tests; defaults are the live process values.
 */
export function resolveInstallIdDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const xdgStateHome = env.XDG_STATE_HOME;
  if (xdgStateHome) return join(xdgStateHome, DIR_NAME);

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA;
    if (localAppData) return join(localAppData, DIR_NAME);
  }

  return join(homedir(), ".config", DIR_NAME);
}

export function resolveInstallIdPath(options: InstallIdOptions = {}): string {
  return join(resolveInstallIdDir(options.env, options.platform), FILE_NAME);
}

function readValidId(file: string): string | null {
  try {
    const existing = readFileSync(file, "utf-8").trim();
    return existing || null;
  } catch {
    return null;
  }
}

function rememberInstallId(file: string, id: string): string {
  cachedInstallId = { file, id };
  return id;
}

export function getOrCreateInstallId(options: InstallIdOptions = {}): string {
  const file = resolveInstallIdPath(options);
  if (cachedInstallId?.file === file) return cachedInstallId.id;

  const existing = readValidId(file);
  if (existing) return rememberInstallId(file, existing);

  mkdirSync(resolveInstallIdDir(options.env, options.platform), {
    recursive: true,
  });
  const id = randomUUID();

  try {
    // `wx` = create-only; fails with EEXIST if another process won the race.
    // `mode` is honored on POSIX and silently ignored on Windows.
    writeFileSync(file, id, { mode: 0o600, flag: "wx" });
    return rememberInstallId(file, id);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    // Another process wrote first. Prefer their id; if the pre-existing file was
    // corrupt (empty/whitespace), overwrite with ours.
    const winner = readValidId(file);
    if (winner) return rememberInstallId(file, winner);
    writeFileSync(file, id, { mode: 0o600 });
    return rememberInstallId(file, id);
  }
}

export function revokeInstallId(options: InstallIdOptions = {}): boolean {
  const file = resolveInstallIdPath(options);
  if (cachedInstallId?.file === file) cachedInstallId = undefined;

  try {
    unlinkSync(file);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

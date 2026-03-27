#!/usr/bin/env node

/**
 * CLI Pre-release QA Flow (v2) — Guided Automation
 *
 * Runs the full QA checklist step-by-step with a step registry.
 * Each step has a unique ID so you can:
 *  - Run all steps sequentially
 *  - Run only specific steps: --only apps.init,apps.extensions
 *  - Retry only failed steps from the last run: --retry-failed
 *  - List all available steps: --list
 *
 * Results are persisted after each step so partial runs are preserved.
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// ─────────────────────────────────────────────
// Config & argument parsing
// ─────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const SKIP_APPS = hasFlag("skip-apps");
const SKIP_THEMES = !hasFlag("include-themes"); // skipped by default, use --include-themes to run
const SKIP_HYDROGEN = hasFlag("skip-hydrogen");
const EXPECTED_VERSION = getArg("nightly-version");
const CLI_VERSION = getArg("cli-version") || "nightly"; // npm dist-tag or exact version
const SKIP_INSTALL = hasFlag("skip-install"); // skip CLI installation step
const RESET_FLAG = hasFlag("reset"); // pass --reset to shopify commands (clears cached store/app selections)
const ONLY_STEPS = getArg("only"); // comma-separated step IDs or prefixes
const RETRY_FAILED = hasFlag("retry-failed");
const LIST_STEPS = hasFlag("list");
const RESULTS_FILE = getArg("results-file"); // custom results file path

const IS_WINDOWS = os.platform() === "win32";
const DESKTOP = path.join(os.homedir(), "Desktop");
const TODAY = new Date().toISOString().split("T")[0];
const QA_APP_NAME = `qa-app-${TODAY}`;
const QA_APP_PATH = path.join(DESKTOP, QA_APP_NAME);
const QA_THEME_NAME = `qa-theme-${TODAY}`;
const QA_THEME_PATH = path.join(DESKTOP, QA_THEME_NAME);
const QA_HYDROGEN_NAME = `qa-hydrogen-${TODAY}`;
const QA_HYDROGEN_PATH = path.join(DESKTOP, QA_HYDROGEN_NAME);
const RESULTS_DIR_OVERRIDE = getArg("results-dir"); // custom directory for all results
const QA_RESULTS_DIR = RESULTS_DIR_OVERRIDE || path.join(DESKTOP, "qa-results");

// --summary with optional version: --summary OR --summary 0.0.0-nightly-20260319
function getSummaryArg() {
  const idx = args.indexOf("--summary");
  if (idx === -1) return { show: false, version: null };
  const next = args[idx + 1];
  // If next arg is another flag or missing, no version specified
  if (!next || next.startsWith("--")) return { show: true, version: null };
  return { show: true, version: next };
}
const SUMMARY_OPT = getSummaryArg();

/**
 * Resolve the results file path based on CLI version.
 * Called after we know the CLI version (from PATH or after install).
 */
let resolvedResultsPath = RESULTS_FILE || null;

function getResultsPath() {
  return resolvedResultsPath || path.join(QA_RESULTS_DIR, `qa-results-unknown.json`);
}

function resolveResultsPathForVersion(cliVersion) {
  if (RESULTS_FILE) return; // user override, don't change
  // Sanitize version for filename: 0.0.0-nightly-20260318 → 0.0.0-nightly-20260318
  const safeVersion = cliVersion.replace(/[^a-zA-Z0-9._-]/g, "_");
  const platform = os.platform();
  resolvedResultsPath = path.join(QA_RESULTS_DIR, `qa-${safeVersion}-${platform}.json`);
}

/**
 * Find all existing results files and return their metadata.
 */
function findExistingResults() {
  if (!fs.existsSync(QA_RESULTS_DIR)) return [];
  return fs.readdirSync(QA_RESULTS_DIR)
    .filter((f) => f.startsWith("qa-") && f.endsWith(".json"))
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(QA_RESULTS_DIR, f), "utf-8"));
        return { file: f, path: path.join(QA_RESULTS_DIR, f), ...data };
      } catch { return null; }
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Terminal colors
// ─────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

// ─────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────
const rl = readline.createInterface({ input, output });

function header(text) {
  const line = "═".repeat(60);
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${text}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

function info(text) {
  console.log(`${C.blue}ℹ${C.reset}  ${text}`);
}

function success(text) {
  console.log(`${C.green}✔${C.reset}  ${text}`);
}

function warn(text) {
  console.log(`${C.yellow}⚠${C.reset}  ${text}`);
}

function fail(text) {
  console.log(`${C.red}✘${C.reset}  ${text}`);
}

function cmdLog(text) {
  console.log(`${C.dim}  $ ${text}${C.reset}`);
}

async function confirm(question) {
  const answer = await rl.question(`\n${C.yellow}❓ ${question}${C.reset} (Y/n) `);
  const val = answer.trim().toLowerCase();
  return val === "" || val === "y" || val === "yes";
}

/**
 * Interactive pass/fail selector using arrow keys.
 * Shows two boxes: [✔ PASS] and [✘ FAIL] — no default, user must choose.
 * Returns true for pass, false for fail.
 */
async function qaVerdict(question) {
  return new Promise((resolve) => {
    let selected = null; // null = no selection, true = pass, false = fail

    const render = () => {
      const passBox = selected === true
        ? `${C.green}${C.bold} ▸ ✔ PASS ${C.reset}`
        : `${C.dim}   ✔ PASS ${C.reset}`;
      const failBox = selected === false
        ? `${C.red}${C.bold} ▸ ✘ FAIL ${C.reset}`
        : `${C.dim}   ✘ FAIL ${C.reset}`;

      process.stdout.write(`\r\x1b[K  ${question}  ${passBox}    ${failBox}  `);
    };

    console.log();
    render();

    // Pause readline so we can read raw keypresses
    rl.pause();
    const wasRaw = input.isRaw;
    if (input.setRawMode) input.setRawMode(true);
    input.resume();

    const onKey = (key) => {
      if (key[0] === 0x1b && key[1] === 0x5b) {
        // Arrow keys: left = 0x44, right = 0x43
        if (key[2] === 0x44) { // left arrow
          selected = true;
          render();
        } else if (key[2] === 0x43) { // right arrow
          selected = false;
          render();
        }
      } else if (key[0] === 0x0d || key[0] === 0x0a) {
        // Enter — confirm selection if one is made
        if (selected !== null) {
          cleanup();
          const icon = selected ? `${C.green}✔ PASS${C.reset}` : `${C.red}✘ FAIL${C.reset}`;
          process.stdout.write(`\r\x1b[K  ${question}  ${icon}\n`);
          resolve(selected);
        }
      } else if (key[0] === 0x03) {
        // Ctrl+C
        cleanup();
        process.exit(1);
      }
    };

    const cleanup = () => {
      input.removeListener("data", onKey);
      if (input.setRawMode) input.setRawMode(wasRaw ?? false);
      input.pause();
      rl.resume();
    };

    input.on("data", onKey);
  });
}

async function manualCheck(description, details) {
  console.log(`\n${C.yellow}${C.bold}👉 MANUAL ACTION REQUIRED${C.reset}`);
  console.log(`${C.yellow}   ${description}${C.reset}`);
  if (details && details.length) {
    console.log();
    for (const line of details) {
      console.log(`   ${C.dim}${line}${C.reset}`);
    }
  }
  return qaVerdict("Result:");
}

// ─────────────────────────────────────────────
// Command execution helpers
// ─────────────────────────────────────────────
function run(command, options = {}) {
  const cwd = options.cwd || process.cwd();
  cmdLog(`${command}  ${C.dim}(in ${cwd})${C.reset}`);
  try {
    execSync(command, {
      cwd,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, ...options.env },
      timeout: options.timeout,
    });
    return true;
  } catch (err) {
    if (options.allowFail) {
      warn(`Command exited with error (non-fatal): ${command}`);
      return false;
    }
    throw err;
  }
}

function runCapture(command, options = {}) {
  const cwd = options.cwd || process.cwd();
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    shell: true,
    env: { ...process.env, ...options.env },
    timeout: options.timeout || 60_000,
  }).trim();
}

function startBackground(command, bgArgs = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  cmdLog(`${command} ${bgArgs.join(" ")}  ${C.dim}(background, in ${cwd})${C.reset}`);
  const proc = spawn(command, bgArgs, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, ...options.env },
    detached: !IS_WINDOWS,
  });

  let buf = "";
  proc.stdout?.on("data", (d) => {
    buf += d.toString();
    if (options.verbose) process.stdout.write(d);
  });
  proc.stderr?.on("data", (d) => {
    buf += d.toString();
    if (options.verbose) process.stderr.write(d);
  });

  return {
    proc,
    getOutput: () => buf,
    kill: () => {
      try {
        if (!IS_WINDOWS && proc.pid) process.kill(-proc.pid, "SIGTERM");
        else proc.kill("SIGTERM");
      } catch { /* already dead */ }
    },
  };
}

async function cleanDir(dirPath, label) {
  if (fs.existsSync(dirPath)) {
    const ok = await confirm(`Found existing ${label} at ${dirPath}. Remove it?`);
    if (ok) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      success(`Removed ${dirPath}`);
    } else {
      warn(`Keeping existing ${label}. This may cause issues.`);
    }
  }
}

// ─────────────────────────────────────────────
// Results persistence
// ─────────────────────────────────────────────

/**
 * Load previous results from disk for a specific results file.
 * Returns a Map of stepId -> { passed, skipped, timestamp, error? }
 */
function loadPreviousResults(filePath) {
  const p = filePath || getResultsPath();
  if (!fs.existsSync(p)) return new Map();
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return new Map((data.steps || []).map((s) => [s.id, s]));
  } catch {
    return new Map();
  }
}

/**
 * Load raw results data from a file.
 */
function loadResultsData(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Save current results to disk after each step.
 */
function saveResults(stepResults, cliVersion) {
  const resultsPath = getResultsPath();
  // Ensure directory exists
  const dir = path.dirname(resultsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const data = {
    date: TODAY,
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cliVersion: cliVersion || null,
    steps: [...stepResults.values()],
    summary: {
      total: stepResults.size,
      passed: [...stepResults.values()].filter((s) => s.passed === true).length,
      failed: [...stepResults.values()].filter((s) => s.passed === false).length,
      skipped: [...stepResults.values()].filter((s) => s.skipped === true).length,
    },
  };

  if (!data.cliVersion) {
    try { data.cliVersion = runCapture("shopify version"); } catch { /* ignore */ }
  }

  fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
// Step Registry
// ─────────────────────────────────────────────

/**
 * Each step: { id, section, name, fn }
 * - id: unique dot-separated identifier (e.g. "apps.init")
 * - section: display group ("Apps", "Themes", "Hydrogen")
 * - name: human-readable step name
 * - fn: async function that returns true (pass) or false (fail)
 */
const STEPS = [];

function registerStep(id, section, name, fn) {
  STEPS.push({ id, section, name, fn });
}

// ─────────────────────────────────────────────
// Shared state across steps
// ─────────────────────────────────────────────
let appDevProcess = null; // holds the background `shopify app dev` process
let hydrogenDevProcess = null; // holds the background `shopify hydrogen dev` process

function killBackgroundProcess(proc) {
  if (!proc) return;
  try {
    if (!IS_WINDOWS && proc.pid) {
      process.kill(proc.pid, "SIGTERM");
    } else {
      proc.kill("SIGTERM");
    }
  } catch { /* already dead */ }
}

// ─────────────────────────────────────────────
// SETUP steps
// ─────────────────────────────────────────────

registerStep("setup.install", "Setup", `Install CLI @shopify/cli@${CLI_VERSION}`, async () => {
  if (SKIP_INSTALL) {
    info("--skip-install flag set, skipping installation.");
    return true;
  }

  info(`Installing @shopify/cli@${CLI_VERSION}...`);
  run(
    `npm i -g @shopify/cli@${CLI_VERSION} --@shopify:registry=https://registry.npmjs.org`,
  );
  success(`@shopify/cli@${CLI_VERSION} installed globally`);
  return true;
});

registerStep("setup.verify_version", "Setup", "Verify CLI version", async () => {
  const version = runCapture("shopify version");
  info(`Installed CLI version: ${version}`);

  if (EXPECTED_VERSION) {
    if (version.includes(EXPECTED_VERSION)) {
      success(`Version matches expected: ${EXPECTED_VERSION}`);
      return true;
    } else {
      fail(`Version mismatch! Expected "${EXPECTED_VERSION}", got "${version}"`);
      return await confirm("Accept this version and continue?");
    }
  }

  // No expected version — just ask user to confirm it looks right
  return await confirm(`CLI version is "${version}". Does this look correct?`);
});

registerStep("setup.check_duplicates", "Setup", "Check for duplicate global CLIs", async () => {
  const whichCmd = IS_WINDOWS ? "where.exe shopify" : "which -a shopify";
  try {
    const result = runCapture(whichCmd);
    const paths = result.split(/\r?\n/).filter((l) => l.trim());
    if (paths.length > 1) {
      warn("Multiple global shopify installations found:");
      for (const p of paths) console.log(`    ${p}`);
      return await confirm("This may cause issues. Continue anyway?");
    }
    info(`Single CLI found at: ${paths[0]}`);
    return true;
  } catch {
    fail("Could not locate shopify CLI on PATH");
    return false;
  }
});

// ─────────────────────────────────────────────
// APPS steps
// ─────────────────────────────────────────────
const RESET = RESET_FLAG ? " --reset" : "";

registerStep("apps.init", "Apps", "Create app (shopify app init)", async () => {
  await cleanDir(QA_APP_PATH, "QA app");
  run(`shopify app init --template reactRouter --name ${QA_APP_NAME} --path ${DESKTOP}`);
  return true;
});

registerStep("apps.config_link", "Apps", "Link app to a Shopify partner app (sets client_id)", async () => {
  info("This will prompt you to select or create a partner app.");
  info("The selected app's client_id will be written to shopify.app.toml.");
  run(`shopify app config link${RESET}`, { cwd: QA_APP_PATH });
  // Verify client_id was set
  const tomlPath = path.join(QA_APP_PATH, "shopify.app.toml");
  if (fs.existsSync(tomlPath)) {
    const content = fs.readFileSync(tomlPath, "utf-8");
    if (content.includes("client_id")) {
      success("client_id found in shopify.app.toml");
      return true;
    }
    fail("client_id not found in shopify.app.toml after config link");
    return false;
  }
  fail("shopify.app.toml not found");
  return false;
});

registerStep("apps.ext.admin_action", "Apps", "Generate admin_action extension", async () => {
  run(
    `shopify app generate extension --template=admin_action --name=admin-action-ext${RESET}`,
    { cwd: QA_APP_PATH },
  );
  return true;
});

registerStep("apps.ext.theme_app", "Apps", "Generate theme_app_extension", async () => {
  run(
    `shopify app generate extension --template=theme_app_extension --name=theme-app-ext${RESET}`,
    { cwd: QA_APP_PATH },
  );
  return true;
});

registerStep("apps.ext.discount", "Apps", "Generate discount function extension", async () => {
  run(
    `shopify app generate extension --template=discount --name=discount-func-ext --flavor=typescript${RESET}`,
    { cwd: QA_APP_PATH },
  );
  return true;
});

registerStep("apps.ext.flow_action", "Apps", "Generate flow_action extension", async () => {
  run(
    `shopify app generate extension --template=flow_action --name=flow-action-ext${RESET}`,
    { cwd: QA_APP_PATH },
  );
  return true;
});

registerStep("apps.ext.random", "Apps", "Generate a random extension (your choice)", async () => {
  info("Running `shopify app generate extension` — choose any template from the interactive list.");
  run(`shopify app generate extension${RESET}`, { cwd: QA_APP_PATH });
  success("Extension generated successfully");
  return true;
});

registerStep("apps.dev_console", "Apps", "Run app dev & verify dev console", async () => {
  info("`shopify app dev` will now take over your terminal.");
  info("The CLI may prompt you to select a store — answer interactively.");
  console.log();
  info(`${C.bold}While dev is running, verify ALL of the following:${C.reset}`);
  console.log(`
   ${C.cyan}Dev console:${C.reset}
     1. Open the shop URL shown in the dev output
     2. See the dev console in the admin
     3. Your app should be the first dev preview, connected (green icon)

   ${C.cyan}Admin-action extension:${C.reset}
     4. From dev-console, open the admin-action extension link
     5. It takes you to a product admin page and opens the action modal
        (Create a product first if needed — ensure it's in stock)

   ${C.cyan}Hot reload:${C.reset}
     6. Change the message inside src/ActionExtension.js
     7. Verify it hot reloads in the browser

   ${C.cyan}Add extension:${C.reset}
     8. In a separate terminal, generate another extension
     9. See it show up in the dev console

   ${C.cyan}GraphQL:${C.reset}
    10. Press \`g\` to open GraphiQL
    11. Run: query { shop { name } }
    12. Verify it returns your shop name

   ${C.cyan}Theme app extension:${C.reset}
    13. Wait for "Theme extension files uploaded" in dev output
    14. Click "Setup your theme app extension in the host theme" link
    15. Click "Add section", choose your app, and "Save"
    16. Open the theme app extension local preview URL (e.g. http://127.0.0.1:9292)
    17. Edit extensions/theme-app-ext/blocks/star_rating.liquid — add "Hello"
    18. Verify it hot reloads in the preview

   ${C.yellow}When done, press \`q\` to stop dev and return to the script.${C.reset}
`);

  const ready = await confirm("Ready to start `shopify app dev`?");
  if (!ready) return false;

  // Pause readline so shopify app dev gets full terminal control
  rl.pause();
  input.setRawMode?.(false);

  info("Handing terminal over to `shopify app dev`...\n");
  console.log(`${C.cyan}${"─".repeat(60)} shopify app dev ${C.reset}\n`);

  // Run with full stdio so all interactive prompts work
  const exitCode = await new Promise((resolve) => {
    const devArgs = ["app", "dev"];
    if (RESET_FLAG) devArgs.push("--reset");
    appDevProcess = spawn("shopify", devArgs, {
      cwd: QA_APP_PATH,
      stdio: "inherit",
    });
    appDevProcess.on("exit", (code) => {
      appDevProcess = null;
      resolve(code);
    });
    appDevProcess.on("error", (err) => {
      appDevProcess = null;
      fail(`Failed to start shopify app dev: ${err.message}`);
      resolve(1);
    });
  });

  console.log(`\n${C.cyan}${"─".repeat(60)} dev stopped ${C.reset}\n`);

  // Resume readline for the script's prompts
  rl.resume();

  if (exitCode !== 0 && exitCode !== null) {
    warn(`shopify app dev exited with code ${exitCode}`);
  }

  return manualCheck(
    "Did ALL the dev console checks pass?",
    [
      `While dev was running, did you verify:`,
      `  ✓ Dev console showed app as connected (green icon)`,
      `  ✓ Admin-action extension opened modal on product page`,
      `  ✓ Hot reload worked after editing ActionExtension.js`,
      `  ✓ New extension showed up in dev console`,
      `  ✓ GraphiQL returned shop name`,
      `  ✓ Theme app extension hot reloaded after editing star_rating.liquid`,
    ],
  );
});

registerStep("apps.graphql_cli", "Apps", "GraphQL via CLI command", async () => {
  info("Testing GraphQL via the standalone CLI command (does not need dev running).");
  run(
    `shopify app execute --query 'query { shop { name } }'`,
    { cwd: QA_APP_PATH },
  );
  return true;
});

registerStep("apps.dev_disconnect", "Apps", "Verify dev console disconnect & clean", async () => {
  // Step 1: Check disconnect state
  const disconnected = await manualCheck(
    "Check that the dev console shows a dev preview marked as DISCONNECTED",
    [
      `After stopping \`shopify app dev\` (you just did this):`,
      ``,
      `Open the dev console in the admin and verify:`,
      `  → The dev preview is still visible but shown as DISCONNECTED`,
    ],
  );
  if (!disconnected) return false;

  // Step 2: Run dev clean automatically
  info("Running `shopify app dev clean`...");
  run("shopify app dev clean", { cwd: QA_APP_PATH });
  success("`shopify app dev clean` completed.");

  // Step 3: Verify preview is hidden
  return manualCheck(
    "Verify the dev preview is now hidden",
    [
      `Go back to the dev console in the admin and verify:`,
      `  → The dev preview is now hidden`,
      `  → If it was the only preview, the entire console should be hidden`,
    ],
  );
});

registerStep("apps.function_build", "Apps", "Function build", async () => {
  const extDir = path.join(QA_APP_PATH, "extensions", "discount-func-ext");
  if (!fs.existsSync(extDir)) {
    // Try to find alternative name
    const extRoot = path.join(QA_APP_PATH, "extensions");
    if (fs.existsSync(extRoot)) {
      const dirs = fs.readdirSync(extRoot);
      const alt = dirs.find((d) => d.includes("discount"));
      if (alt) {
        info(`Using alternative discount dir: ${alt}`);
        run("shopify app function build", { cwd: path.join(extRoot, alt) });
        return true;
      }
    }
    throw new Error(`Discount extension dir not found at ${extDir}`);
  }
  run("shopify app function build", { cwd: extDir });
  return true;
});

registerStep("apps.function_run", "Apps", "Function run", async () => {
  let extDir = path.join(QA_APP_PATH, "extensions", "discount-func-ext");
  if (!fs.existsSync(extDir)) {
    const extRoot = path.join(QA_APP_PATH, "extensions");
    const dirs = fs.existsSync(extRoot) ? fs.readdirSync(extRoot) : [];
    const alt = dirs.find((d) => d.includes("discount"));
    if (alt) extDir = path.join(extRoot, alt);
    else throw new Error(`Discount extension dir not found`);
  }

  const functionInput =
    '{"cart":{"lines":[{"id":"gid://shopify/CartLine/0","cost":{"subtotalAmount":{"amount":"10.0"}}}]},"discount":{"discountClasses":["PRODUCT","ORDER","SHIPPING"]}}';

  if (IS_WINDOWS) {
    const tmpInput = path.join(os.tmpdir(), "qa-function-input.json");
    fs.writeFileSync(tmpInput, functionInput);
    run(`type "${tmpInput}" | shopify app function run`, { cwd: extDir });
  } else {
    run(`echo '${functionInput}' | shopify app function run`, { cwd: extDir });
  }
  return true;
});

registerStep("apps.deploy", "Apps", "Deploy app (v1)", async () => {
  run(`shopify app deploy --version v1 --force${RESET}`, { cwd: QA_APP_PATH });
  return true;
});

registerStep("apps.deploy_release", "Apps", "Verify deploy release", async () => {
  return manualCheck(
    "Release the version in the Partner Dashboard if needed",
    [`The deploy command should have prompted you to release — verify in the dashboard.`],
  );
});

registerStep("apps.versions_list", "Apps", "Versions list", async () => {
  run("shopify app versions list", { cwd: QA_APP_PATH });
  return manualCheck("Verify your version v1 appears in the list above", []);
});

registerStep("apps.config_link_redeploy", "Apps", "Config link & redeploy to new app", async () => {
  info("Running `shopify app config link` — select or create a NEW app when prompted.");
  run(`shopify app config link${RESET}`, { cwd: QA_APP_PATH });
  success("App config linked to new app.");

  info("Deploying to the new app...");
  run(`shopify app deploy --force${RESET}`, { cwd: QA_APP_PATH });
  success("Deploy to new app completed.");
  return true;
});

// ─────────────────────────────────────────────
// THEMES steps
// ─────────────────────────────────────────────

registerStep("themes.init", "Themes", "Create theme (shopify theme init)", async () => {
  await cleanDir(QA_THEME_PATH, "QA theme");
  run(`shopify theme init ${QA_THEME_NAME}`, { cwd: DESKTOP });
  return true;
});

registerStep("themes.check", "Themes", "Theme check", async () => {
  run("shopify theme check --fail-level crash", { cwd: QA_THEME_PATH });
  return true;
});

registerStep("themes.package", "Themes", "Theme package", async () => {
  run("shopify theme package", { cwd: QA_THEME_PATH });
  return true;
});

registerStep("themes.dev_hotreload", "Themes", "Theme dev + hot reload", async () => {
  const store = await rl.question(`${C.yellow}❓ Enter your dev store name:${C.reset} `);
  return manualCheck(
    "Run theme dev and test hot reload",
    [
      `  cd ${QA_THEME_PATH}`,
      `  shopify theme dev --store ${store}`,
      ``,
      `1. Open http://127.0.0.1:9292 to see the test theme`,
      `2. Insert some text inside the first <div> in sections/announcement-bar.liquid`,
      `3. Verify the text appears across the top of the page (hot reload)`,
      `4. Stop with CTRL+C when done`,
    ],
  );
});

registerStep("themes.push", "Themes", "Theme push", async () => {
  const store = await rl.question(`${C.yellow}❓ Enter your dev store name:${C.reset} `);
  run(`shopify theme push --store ${store}`, { cwd: QA_THEME_PATH });
  return true;
});

registerStep("themes.list", "Themes", "Theme list", async () => {
  const store = await rl.question(`${C.yellow}❓ Enter your dev store name:${C.reset} `);
  run(`shopify theme list --store ${store}`, { cwd: QA_THEME_PATH });
  return true;
});

// ─────────────────────────────────────────────
// HYDROGEN steps
// ─────────────────────────────────────────────

registerStep("hydrogen.init", "Hydrogen", "Create Hydrogen app", async () => {
  await cleanDir(QA_HYDROGEN_PATH, "QA hydrogen app");
  info("Creating Hydrogen app with --quickstart (default options: JS, mock.shop, no markets)...");
  run(`shopify hydrogen init --path ${QA_HYDROGEN_PATH} --quickstart`);
  return true;
});

registerStep("hydrogen.build", "Hydrogen", "Hydrogen build", async () => {
  run("shopify hydrogen build", { cwd: QA_HYDROGEN_PATH });
  return true;
});

registerStep("hydrogen.dev", "Hydrogen", "Hydrogen dev & verify storefront", async () => {
  info("Starting `shopify hydrogen dev` in the background...");

  let devUrl = null;

  hydrogenDevProcess = spawn("shopify", ["hydrogen", "dev"], {
    cwd: QA_HYDROGEN_PATH,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Capture output to extract the dev URL
  let outputBuffer = "";
  const captureOutput = (data) => {
    const text = data.toString();
    outputBuffer += text;
    // Look for the local dev URL (e.g. http://localhost:3000)
    const urlMatch = text.match(/(https?:\/\/localhost:\d+)/);
    if (urlMatch && !devUrl) {
      devUrl = urlMatch[1];
    }
  };
  hydrogenDevProcess.stdout?.on("data", captureOutput);
  hydrogenDevProcess.stderr?.on("data", captureOutput);

  let processExited = false;
  hydrogenDevProcess.on("exit", (code) => {
    processExited = true;
    if (code !== null && code !== 0) {
      warn(`shopify hydrogen dev exited with code ${code}`);
    }
    hydrogenDevProcess = null;
  });

  hydrogenDevProcess.on("error", (err) => {
    processExited = true;
    fail(`Failed to start shopify hydrogen dev: ${err.message}`);
    hydrogenDevProcess = null;
  });

  // Wait for the URL to appear in output (up to 60s)
  info("Waiting for Hydrogen dev server to start...");
  const startTime = Date.now();
  while (!devUrl && !processExited && Date.now() - startTime < 60_000) {
    await sleep(1000);
  }

  if (processExited) {
    fail("Hydrogen dev server exited before starting.");
    info("Server output:");
    console.log(`${C.dim}${outputBuffer}${C.reset}`);
    return false;
  }

  if (!devUrl) {
    warn("Could not detect dev URL from output. Showing raw output:");
    console.log(`${C.dim}${outputBuffer}${C.reset}`);
    devUrl = "http://localhost:3000 (assumed)";
  }

  console.log();
  success(`Hydrogen dev server is running!`);
  console.log(`\n  ${C.cyan}${C.bold}→ Open in your browser: ${devUrl}${C.reset}\n`);

  const passed = await manualCheck(
    "Can you see the Hydrogen storefront?",
    [
      `Open the URL above in your browser and verify:`,
      `  ✓ The storefront is visible`,
      `  ✓ The page renders correctly with product data`,
    ],
  );

  // Kill the dev server
  info("Stopping Hydrogen dev server...");
  killBackgroundProcess(hydrogenDevProcess);
  hydrogenDevProcess = null;
  await sleep(1000);
  success("Hydrogen dev server stopped.");

  return passed;
});

// ─────────────────────────────────────────────
// Step filtering logic
// ─────────────────────────────────────────────

/**
 * Determine which steps should run based on flags:
 *  --only step1,step2        Run only these (supports prefix matching: "apps" = all apps.*)
 *  --retry-failed            Re-run only steps that failed in the last saved results
 *  --skip-apps/themes/hydrogen  Skip entire sections
 *
 * Returns Set of step IDs to run.
 */
function resolveStepsToRun(previousResults) {
  let stepsToRun = new Set(STEPS.map((s) => s.id));

  // Apply section skips
  if (SKIP_APPS) {
    for (const s of STEPS) {
      if (s.id.startsWith("apps.")) stepsToRun.delete(s.id);
    }
  }
  if (SKIP_THEMES) {
    for (const s of STEPS) {
      if (s.id.startsWith("themes.")) stepsToRun.delete(s.id);
    }
  }
  if (SKIP_HYDROGEN) {
    for (const s of STEPS) {
      if (s.id.startsWith("hydrogen.")) stepsToRun.delete(s.id);
    }
  }

  // --only filter: supports exact IDs and prefix matching
  if (ONLY_STEPS) {
    const patterns = ONLY_STEPS.split(",").map((s) => s.trim());
    const filtered = new Set();
    for (const stepDef of STEPS) {
      for (const pattern of patterns) {
        if (stepDef.id === pattern || stepDef.id.startsWith(pattern + ".") || stepDef.id.startsWith(pattern)) {
          filtered.add(stepDef.id);
        }
      }
    }
    stepsToRun = filtered;
  }

  // --retry-failed: only re-run steps that previously failed
  if (RETRY_FAILED && previousResults.size > 0) {
    const failedIds = new Set();
    for (const [id, result] of previousResults) {
      if (result.passed === false) failedIds.add(id);
    }
    // Also include steps that were never run (not in previous results)
    const neverRun = new Set();
    for (const s of STEPS) {
      if (!previousResults.has(s.id)) neverRun.add(s.id);
    }

    const retrySet = new Set([...failedIds, ...neverRun]);
    stepsToRun = new Set([...stepsToRun].filter((id) => retrySet.has(id)));

    if (failedIds.size > 0) {
      info(`Retrying ${failedIds.size} failed step(s): ${[...failedIds].join(", ")}`);
    }
    if (neverRun.size > 0) {
      info(`Also running ${neverRun.size} step(s) that were never executed.`);
    }
  }

  return stepsToRun;
}

// ─────────────────────────────────────────────
// List steps
// ─────────────────────────────────────────────
function listSteps(previousResults) {
  header("AVAILABLE QA STEPS");

  const maxId = Math.max(...STEPS.map((s) => s.id.length));
  const maxSection = Math.max(...STEPS.map((s) => s.section.length));

  let currentSection = "";
  for (const step of STEPS) {
    if (step.section !== currentSection) {
      currentSection = step.section;
      console.log(`\n  ${C.cyan}${C.bold}${currentSection}${C.reset}`);
    }

    // Show previous result status if available
    let statusIcon = `${C.dim}○${C.reset}`; // not run
    const prev = previousResults.get(step.id);
    if (prev) {
      if (prev.skipped) statusIcon = `${C.yellow}⊘${C.reset}`;
      else if (prev.passed === true) statusIcon = `${C.green}✔${C.reset}`;
      else if (prev.passed === false) statusIcon = `${C.red}✘${C.reset}`;
    }

    const id = step.id.padEnd(maxId);
    console.log(`    ${statusIcon}  ${C.bold}${id}${C.reset}  ${C.dim}${step.name}${C.reset}`);
  }

  console.log(`\n  ${C.dim}Legend: ✔ passed  ✘ failed  ⊘ skipped  ○ not run${C.reset}`);
  console.log(`\n  ${C.dim}Use --only <id>,<id> to run specific steps${C.reset}`);
  console.log(`  ${C.dim}Use prefix matching: --only apps (runs all apps.* steps)${C.reset}`);
  console.log(`  ${C.dim}Use --retry-failed to re-run only failed/unrun steps${C.reset}\n`);
}

// ─────────────────────────────────────────────
// Summary helpers
// ─────────────────────────────────────────────

/**
 * Print a compact summary of previously passed/failed/skipped steps.
 */
function printPreviousRunSummary(previousResults) {
  const allResults = [...previousResults.values()];
  if (allResults.length === 0) return;

  const passed = allResults.filter((s) => s.passed === true);
  const failed = allResults.filter((s) => s.passed === false);
  // "Skipped" = intentionally skipped (has a timestamp or was explicitly skipped by section skip)
  // "Not run" = passed is null (never actually executed — script stopped before reaching them)
  const skipped = allResults.filter((s) => s.skipped === true && s.passed === true);
  const notExecuted = allResults.filter((s) => s.passed === null);

  // Also check for steps not in the results file at all
  const notInFile = STEPS.filter((s) => !previousResults.has(s.id));
  const allNotRun = [...notExecuted, ...notInFile.map((s) => ({ id: s.id, name: s.name }))];

  header("PREVIOUS RUN RESULTS");

  if (passed.length > 0) {
    console.log(`  ${C.green}${C.bold}Already passed (${passed.length}):${C.reset}`);
    for (const r of passed) {
      console.log(`    ${C.green}✔${C.reset}  ${r.id}  ${C.dim}${r.name}${C.reset}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n  ${C.red}${C.bold}Previously failed (${failed.length}):${C.reset}`);
    for (const r of failed) {
      const err = r.error ? `  ${C.red}${r.error}${C.reset}` : "";
      console.log(`    ${C.red}✘${C.reset}  ${r.id}  ${C.dim}${r.name}${C.reset}${err}`);
    }
  }

  if (allNotRun.length > 0) {
    console.log(`\n  ${C.dim}${C.bold}Not run (${allNotRun.length}):${C.reset}`);
    for (const s of allNotRun) {
      console.log(`    ${C.dim}○  ${s.id}  ${s.name}${C.reset}`);
    }
  }

  console.log();
  console.log(
    `  ${C.bold}Total: ${STEPS.length}${C.reset}  |  ` +
    `${C.green}Passed: ${passed.length}${C.reset}  |  ` +
    `${C.red}Failed: ${failed.length}${C.reset}  |  ` +
    `${C.dim}Not run: ${allNotRun.length}${C.reset}`,
  );
  console.log();
}

function printSummary(stepResults) {
  header("QA RESULTS SUMMARY");

  const allResults = [...stepResults.values()];
  const passed = allResults.filter((s) => s.passed === true).length;
  const failed = allResults.filter((s) => s.passed === false).length;
  const skipped = allResults.filter((s) => s.skipped === true).length;
  const total = allResults.length;

  console.log(`  ${C.bold}Platform:${C.reset}  ${os.platform()} ${os.arch()}`);
  console.log(`  ${C.bold}Node:${C.reset}      ${process.version}`);
  try {
    const ver = runCapture("shopify version");
    console.log(`  ${C.bold}CLI:${C.reset}       ${ver}`);
  } catch { /* ignore */ }
  console.log(`  ${C.bold}Date:${C.reset}      ${TODAY}`);
  console.log(`  ${C.bold}Results:${C.reset}   ${getResultsPath()}`);
  console.log();

  const maxId = Math.max(...allResults.map((r) => r.id.length));

  let currentSection = "";
  for (const r of allResults) {
    if (r.section !== currentSection) {
      currentSection = r.section;
      console.log(`\n  ${C.cyan}${C.bold}${currentSection}${C.reset}`);
    }

    let icon;
    if (r.skipped) icon = `${C.yellow}⊘${C.reset}`;
    else if (r.passed === true) icon = `${C.green}✔${C.reset}`;
    else if (r.passed === false) icon = `${C.red}✘${C.reset}`;
    else icon = `${C.dim}○${C.reset}`;

    const id = r.id.padEnd(maxId);
    const err = r.error ? `  ${C.red}${r.error}${C.reset}` : "";
    console.log(`    ${icon}  ${id}  ${C.dim}${r.name}${C.reset}${err}`);
  }

  console.log();
  console.log(
    `  ${C.bold}Total: ${total}${C.reset}  |  ` +
    `${C.green}Passed: ${passed}${C.reset}  |  ` +
    `${C.red}Failed: ${failed}${C.reset}  |  ` +
    `${C.yellow}Skipped: ${skipped}${C.reset}`,
  );
  console.log();

  if (failed > 0) {
    warn("Some steps failed. Review the failures above.");
    info("Run the script again — it will detect the results and offer to retry only failed steps.");
  } else if (passed > 0 && failed === 0) {
    success("All executed steps passed! 🎉");
  }
}

// ─────────────────────────────────────────────
// Pre-flight
// ─────────────────────────────────────────────
async function preflight() {
  header("PRE-FLIGHT CHECKS");

  info(`OS: ${os.platform()} (${os.arch()})`);
  info(`Node: ${process.version}`);

  info(`CLI version:   ${CLI_VERSION}${SKIP_INSTALL ? " (skip-install, using PATH)" : " (will install)"}`);

  try {
    const cliVersion = runCapture("shopify version");
    info(`Current CLI on PATH: ${cliVersion}`);
  } catch {
    if (SKIP_INSTALL) {
      fail("shopify CLI not found on PATH and --skip-install is set!");
      process.exit(1);
    }
    warn("shopify CLI not found on PATH — will be installed by setup.install step.");
  }

  console.log();
  info(`QA app path:      ${QA_APP_PATH}`);
  info(`QA theme path:    ${QA_THEME_PATH}`);
  info(`QA hydrogen path: ${QA_HYDROGEN_PATH}`);
  info(`Results file:     ${getResultsPath()}`);
}

// ─────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────
function printHelp() {
  console.log(`
${C.bold}CLI Pre-release QA Flow — Guided Automation${C.reset}

${C.bold}Usage:${C.reset}
  node qa/run-qa.mjs [options]

${C.bold}Options:${C.reset}
  --cli-version <tag>      CLI dist-tag or version to install (default: "nightly")
                           Examples: nightly, experimental, 3.92.0-nightly.1
  --nightly-version <v>    Expected version string to verify after install
  --skip-install           Skip CLI installation (use whatever is on PATH)
  --reset                  Pass --reset to shopify commands (clears cached store/app selections)

  ${C.bold}Step selection:${C.reset}
  --list                   List all steps and their last-run status
  --only <ids>             Run only specific steps (comma-separated)
                           Supports prefix matching: --only apps (= all apps.*)
                           Examples:
                             --only apps.init
                             --only apps.init,apps.ext.admin_action
                             --only apps,hydrogen
  --retry-failed           Re-run only steps that failed in the last run
                           (also runs steps that were never executed)

  ${C.bold}Sections:${C.reset}
  --skip-apps              Skip all Apps steps
  --skip-hydrogen          Skip all Hydrogen steps
  --include-themes         Include Themes steps (skipped by default, owned by themes team)

  ${C.bold}Results:${C.reset}
  --summary [version]      Show results summary. If no version given, pick from a list
                           Supports partial matching: --summary 20260319
  --results-dir <path>     Custom directory for all results files (default: ~/Desktop/qa-results)
  --results-file <path>    Custom path for a specific results file (overrides --results-dir)

  ${C.bold}Other:${C.reset}
  --help                   Show this help

${C.bold}Examples:${C.reset}
  ${C.dim}# Full run${C.reset}
  node qa/run-qa.mjs

  ${C.dim}# List all steps with status from last run${C.reset}
  node qa/run-qa.mjs --list

  ${C.dim}# Run only the hydrogen steps${C.reset}
  node qa/run-qa.mjs --only hydrogen

  ${C.dim}# Run a specific step${C.reset}
  node qa/run-qa.mjs --only apps.function_build

  ${C.dim}# Retry only what failed last time${C.reset}
  node qa/run-qa.mjs --retry-failed

  ${C.dim}# Combine: retry failed, but only in apps section${C.reset}
  node qa/run-qa.mjs --retry-failed --skip-themes --skip-hydrogen

  ${C.dim}# View results — interactive picker${C.reset}
  node qa/run-qa.mjs --summary

  ${C.dim}# View results for a specific version (partial match)${C.reset}
  node qa/run-qa.mjs --summary 20260319
  node qa/run-qa.mjs --summary 0.0.0-nightly-20260319062421

  ${C.dim}# Use a custom results directory${C.reset}
  node qa/run-qa.mjs --results-dir /shared/qa-results
  node qa/run-qa.mjs --summary --results-dir /shared/qa-results
`);
}

// ─────────────────────────────────────────────
// Summary command
// ─────────────────────────────────────────────

/**
 * Show a detailed summary of QA results for a specific version,
 * or let the user pick from existing results.
 */
async function showSummary() {
  header("QA RESULTS SUMMARY");

  const existing = findExistingResults();

  if (existing.length === 0) {
    info(`No results found in ${QA_RESULTS_DIR}`);
    info("Run the QA script first to generate results.");
    process.exit(0);
  }

  let selectedData = null;

  if (SUMMARY_OPT.version) {
    // Find results matching the requested version (partial match)
    const matches = existing.filter((r) =>
      r.cliVersion?.includes(SUMMARY_OPT.version) ||
      r.file.includes(SUMMARY_OPT.version),
    );

    if (matches.length === 0) {
      fail(`No results found matching version "${SUMMARY_OPT.version}"`);
      info("Available results:");
      for (const r of existing) {
        console.log(`  ${C.dim}${r.cliVersion || "unknown"}  (${r.platform}, ${r.date})  → ${r.file}${C.reset}`);
      }
      process.exit(1);
    } else if (matches.length === 1) {
      selectedData = matches[0];
    } else {
      // Multiple matches — let user pick
      info(`Multiple results match "${SUMMARY_OPT.version}":`);
      for (let i = 0; i < matches.length; i++) {
        const r = matches[i];
        const passed = r.summary?.passed || 0;
        const failed = r.summary?.failed || 0;
        console.log(
          `  ${C.bold}[${i + 1}]${C.reset} ${r.cliVersion || "unknown"}  ` +
          `${C.dim}(${r.platform}, ${r.date})${C.reset}  ` +
          `${C.green}✔${passed}${C.reset} ${C.red}✘${failed}${C.reset}`,
        );
      }
      const answer = await rl.question(`\n  Select [1-${matches.length}]: `);
      const idx = parseInt(answer.trim(), 10) - 1;
      if (idx >= 0 && idx < matches.length) {
        selectedData = matches[idx];
      } else {
        fail("Invalid selection.");
        process.exit(1);
      }
    }
  } else {
    // No version specified — auto-select if only one, otherwise show picker
    if (existing.length === 1) {
      selectedData = existing[0];
      info(`Found 1 result: ${selectedData.cliVersion || "unknown"} (${selectedData.platform}, ${selectedData.date})`);
    } else {
    info(`Found ${existing.length} results in ${QA_RESULTS_DIR}:\n`);

    // Sort by date descending
    existing.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    for (let i = 0; i < existing.length; i++) {
      const r = existing[i];
      const passed = r.summary?.passed || 0;
      const failed = r.summary?.failed || 0;
      const skipped = r.summary?.skipped || 0;
      const total = r.summary?.total || 0;

      let statusIcon = `${C.green}✔${C.reset}`;
      if (failed > 0) statusIcon = `${C.red}✘${C.reset}`;
      else if (passed < total) statusIcon = `${C.yellow}…${C.reset}`;

      console.log(
        `  ${C.bold}[${i + 1}]${C.reset} ${statusIcon}  ` +
        `${C.bold}${r.cliVersion || "unknown"}${C.reset}  ` +
        `${C.dim}${r.platform} · ${r.date}${C.reset}  ` +
        `${C.green}✔${passed}${C.reset} ${C.red}✘${failed}${C.reset} ${C.yellow}⊘${skipped}${C.reset}`,
      );
    }

    const answer = await rl.question(`\n  Select [1-${existing.length}] or [q]uit: `);
    if (answer.trim().toLowerCase() === "q") process.exit(0);
    const idx = parseInt(answer.trim(), 10) - 1;
    if (idx >= 0 && idx < existing.length) {
      selectedData = existing[idx];
    } else {
      fail("Invalid selection.");
      process.exit(1);
    }
    } // end else (multiple results)
  }

  // ── Print detailed summary ──
  console.log();
  const line = "─".repeat(60);
  console.log(`${C.cyan}${line}${C.reset}`);
  console.log(`  ${C.bold}CLI Version:${C.reset}  ${selectedData.cliVersion || "unknown"}`);
  console.log(`  ${C.bold}Platform:${C.reset}     ${selectedData.platform || "unknown"} ${selectedData.arch || ""}`);
  console.log(`  ${C.bold}Node:${C.reset}         ${selectedData.nodeVersion || "unknown"}`);
  console.log(`  ${C.bold}Date:${C.reset}         ${selectedData.date || "unknown"}`);
  console.log(`  ${C.bold}File:${C.reset}         ${selectedData.path}`);
  console.log(`${C.cyan}${line}${C.reset}`);

  const steps = selectedData.steps || [];
  const passed = steps.filter((s) => s.passed === true);
  const failed = steps.filter((s) => s.passed === false);
  const skipped = steps.filter((s) => s.skipped === true);
  const notRun = steps.filter((s) => s.passed === null && !s.skipped);

  if (passed.length > 0) {
    console.log(`\n  ${C.green}${C.bold}Passed (${passed.length}):${C.reset}`);
    for (const s of passed) {
      const dur = s.duration ? ` ${C.dim}(${(s.duration / 1000).toFixed(1)}s)${C.reset}` : "";
      console.log(`    ${C.green}✔${C.reset}  ${s.id}  ${C.dim}${s.name}${C.reset}${dur}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n  ${C.red}${C.bold}Failed (${failed.length}):${C.reset}`);
    for (const s of failed) {
      const err = s.error ? `\n       ${C.red}${s.error}${C.reset}` : "";
      const dur = s.duration ? ` ${C.dim}(${(s.duration / 1000).toFixed(1)}s)${C.reset}` : "";
      console.log(`    ${C.red}✘${C.reset}  ${s.id}  ${C.dim}${s.name}${C.reset}${dur}${err}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n  ${C.yellow}${C.bold}Skipped (${skipped.length}):${C.reset}`);
    for (const s of skipped) {
      console.log(`    ${C.yellow}⊘${C.reset}  ${s.id}  ${C.dim}${s.name}${C.reset}`);
    }
  }

  if (notRun.length > 0) {
    console.log(`\n  ${C.dim}${C.bold}Not run (${notRun.length}):${C.reset}`);
    for (const s of notRun) {
      console.log(`    ${C.dim}○  ${s.id}  ${s.name}${C.reset}`);
    }
  }

  console.log();
  console.log(
    `  ${C.bold}Total: ${steps.length}${C.reset}  |  ` +
    `${C.green}Passed: ${passed.length}${C.reset}  |  ` +
    `${C.red}Failed: ${failed.length}${C.reset}  |  ` +
    `${C.yellow}Skipped: ${skipped.length}${C.reset}  |  ` +
    `${C.dim}Not run: ${notRun.length}${C.reset}`,
  );
  console.log();

  if (failed.length === 0 && notRun.length === 0 && skipped.length === 0) {
    success("All steps passed! Release is GO. 🎉");
  } else if (failed.length === 0 && notRun.length === 0) {
    success("All executed steps passed (some skipped). ✔");
  } else if (failed.length > 0) {
    warn(`${failed.length} step(s) failed — release is NOT ready.`);
  } else {
    info(`${notRun.length} step(s) not yet run.`);
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  header("CLI PRE-RELEASE QA FLOW (v2)");

  if (hasFlag("help")) {
    printHelp();
    process.exit(0);
  }

  if (SUMMARY_OPT.show) {
    await showSummary();
    process.exit(0);
  }

  // ── Step 1: Detect CLI version and resolve results file ──
  let cliVersion = null;
  try {
    cliVersion = runCapture("shopify version");
  } catch {
    // CLI not installed yet — will be installed by setup.install
  }

  if (cliVersion) {
    resolveResultsPathForVersion(cliVersion);
  }

  // ── Step 2: Check for existing results for this CLI version ──
  let previousResults = loadPreviousResults();
  let continueFromPrevious = false;

  if (LIST_STEPS) {
    listSteps(previousResults);
    process.exit(0);
  }

  if (previousResults.size > 0 && !ONLY_STEPS && !RETRY_FAILED) {
    const prevData = loadResultsData(getResultsPath());
    const allPrev = [...previousResults.values()];
    const passed = allPrev.filter((s) => s.passed === true).length;
    const failed = allPrev.filter((s) => s.passed === false).length;
    // "Not run" = steps not in results at all OR saved with passed: null (never executed)
    const notInFile = STEPS.filter((s) => !previousResults.has(s.id)).length;
    const neverExecuted = allPrev.filter((s) => s.passed === null).length;
    const notRun = notInFile + neverExecuted;

    console.log(`${C.cyan}${C.bold}  Found existing results for CLI ${prevData?.cliVersion || "unknown"}${C.reset}`);
    console.log(`  ${C.dim}File: ${getResultsPath()}${C.reset}`);
    console.log(`  ${C.green}Passed: ${passed}${C.reset}  |  ${C.red}Failed: ${failed}${C.reset}  |  ${C.dim}Not run: ${notRun}${C.reset}\n`);

    if (failed > 0 || notRun > 0) {
      // Show summary of what's been done
      printPreviousRunSummary(previousResults);

      const answer = await rl.question(
        `${C.yellow}❓ What would you like to do?${C.reset}\n` +
        `   ${C.bold}[c]${C.reset} Continue — retry only failed/not-run steps\n` +
        `   ${C.bold}[f]${C.reset} Fresh start — run all steps from scratch\n` +
        `   ${C.bold}[q]${C.reset} Quit\n` +
        `\n   Choice: `,
      );

      const choice = answer.trim().toLowerCase();
      if (choice === "q") {
        console.log("🛑 Aborted.\n");
        process.exit(0);
      } else if (choice === "c") {
        continueFromPrevious = true;
        info("Continuing from previous run — only failed and not-run steps will execute.");
      } else {
        info("Starting fresh — all steps will run.");
        previousResults = new Map(); // clear
      }
    } else {
      // All passed previously
      printPreviousRunSummary(previousResults);
      const rerun = await confirm("All steps passed in the previous run. Run everything again?");
      if (!rerun) {
        success("Nothing to do — all steps already passed! 🎉");
        process.exit(0);
      }
      previousResults = new Map(); // fresh run
    }
  }

  // ── Step 3: Determine which steps to run ──
  let stepsToRun;
  if (continueFromPrevious || RETRY_FAILED) {
    // Build set: failed + never executed (not in file OR saved with passed: null)
    const failedIds = new Set();
    const neverRunIds = new Set();
    for (const [id, result] of previousResults) {
      if (result.passed === false) failedIds.add(id);
      if (result.passed === null) neverRunIds.add(id);
    }
    for (const s of STEPS) {
      if (!previousResults.has(s.id)) neverRunIds.add(s.id);
    }
    stepsToRun = new Set([...failedIds, ...neverRunIds]);

    // Still apply section skips
    if (SKIP_APPS) for (const s of STEPS) { if (s.id.startsWith("apps.")) stepsToRun.delete(s.id); }
    if (SKIP_THEMES) for (const s of STEPS) { if (s.id.startsWith("themes.")) stepsToRun.delete(s.id); }
    if (SKIP_HYDROGEN) for (const s of STEPS) { if (s.id.startsWith("hydrogen.")) stepsToRun.delete(s.id); }

    // Apply --only filter on top
    if (ONLY_STEPS) {
      const patterns = ONLY_STEPS.split(",").map((s) => s.trim());
      stepsToRun = new Set([...stepsToRun].filter((id) =>
        patterns.some((p) => id === p || id.startsWith(p + ".") || id.startsWith(p))
      ));
    }

    if (failedIds.size > 0) info(`Retrying ${failedIds.size} failed step(s): ${[...failedIds].join(", ")}`);
    if (neverRunIds.size > 0) info(`Running ${neverRunIds.size} never-run step(s).`);
  } else {
    stepsToRun = resolveStepsToRun(previousResults);
  }

  if (stepsToRun.size === 0) {
    info("No steps to run. Use --list to see all steps, or remove filters.");
    process.exit(0);
  }

  info(`Will run ${stepsToRun.size} of ${STEPS.length} steps.`);

  // ── Step 4: Build merged results map ──
  const stepResults = new Map();
  for (const step of STEPS) {
    const prev = previousResults.get(step.id);
    if (stepsToRun.has(step.id)) {
      // Will be executed — placeholder
      stepResults.set(step.id, {
        id: step.id,
        section: step.section,
        name: step.name,
        passed: null,
        skipped: false,
        error: null,
        timestamp: null,
      });
    } else if (prev && prev.passed === true) {
      // Keep previous passing result
      stepResults.set(step.id, { ...prev });
    } else if (prev) {
      // Keep other previous results
      stepResults.set(step.id, { ...prev, skipped: prev.skipped ?? true });
    } else {
      // Never run and not selected
      stepResults.set(step.id, {
        id: step.id,
        section: step.section,
        name: step.name,
        passed: null,
        skipped: true,
        error: null,
        timestamp: null,
      });
    }
  }

  // ── Step 5: Pre-flight and confirm ──
  await preflight();
  const ready = await confirm(`Run ${stepsToRun.size} step(s)?`);
  if (!ready) {
    console.log("🛑 Aborted.\n");
    process.exit(0);
  }

  // ── Step 6: Execute steps ──
  let currentSection = "";
  for (const step of STEPS) {
    if (!stepsToRun.has(step.id)) continue;

    // Section header
    if (step.section !== currentSection) {
      currentSection = step.section;
      header(`${currentSection} QA`);
    }

    console.log(
      `\n${C.magenta}${C.bold}── ${step.id}: ${step.name} ──${C.reset}\n`,
    );

    const startTime = Date.now();
    let stepPassed = false;

    try {
      const passed = await step.fn();
      stepPassed = passed !== false;
    } catch (err) {
      const result = stepResults.get(step.id);
      result.passed = false;
      result.error = err.message || String(err);
      result.timestamp = new Date().toISOString();
      result.duration = Date.now() - startTime;

      fail(`${step.id}: ERROR — ${err.message}`);
    }

    const result = stepResults.get(step.id);
    if (result.passed === null) {
      // Not set by catch block
      result.passed = stepPassed;
      result.timestamp = new Date().toISOString();
      result.duration = Date.now() - startTime;
    }

    if (result.passed) {
      success(`${step.id}: PASSED`);
    } else {
      fail(`${step.id}: FAILED`);

      // Always offer continue or exit on failure
      console.log(`\n  ${C.bold}[c]${C.reset} Continue to next step`);
      console.log(`  ${C.bold}[q]${C.reset} Quit (progress is saved)\n`);
      const answer = await rl.question(`  Choice: `);
      if (answer.trim().toLowerCase() === "q") {
        info("Progress saved. Run again to continue from where you left off.");
        saveResults(stepResults, cliVersion);
        printSummary(stepResults);
        process.exit(1);
      }
    }

    // Save after every step
    saveResults(stepResults, cliVersion);
  }

  // ── Step 7: Update CLI version in results if it changed (e.g. after setup.install) ──
  try {
    const finalVersion = runCapture("shopify version");
    if (finalVersion !== cliVersion) {
      cliVersion = finalVersion;
      resolveResultsPathForVersion(cliVersion);
    }
  } catch { /* ignore */ }

  printSummary(stepResults);
  saveResults(stepResults, cliVersion);
}

main()
  .catch((err) => {
    console.error(`\n${C.red}${C.bold}Fatal error:${C.reset}`, err);
    process.exit(1);
  })
  .finally(() => {
    // Clean up dev servers if still running
    killBackgroundProcess(appDevProcess);
    appDevProcess = null;
    killBackgroundProcess(hydrogenDevProcess);
    hydrogenDevProcess = null;
    rl.close();
  });

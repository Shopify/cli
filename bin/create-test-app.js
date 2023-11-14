#! /usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { execa } from "execa";
import path from "path";
import os from "os";
import fs from "fs";

const require = createRequire(import.meta.url);
const { program } = require("commander");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const homeDir = os.homedir();
const today = new Date().toISOString().split("T")[0];

const installationTypes = ["local", "nightly", "experimental"];
const extensionTypes = ["ui", "theme", "function"];
const packageManagers = ["npm", "yarn", "pnpm", "bun"];

program
  .description("Creates a test app.")
  .option(
    "-i, --install <type>",
    `installation type: ${installationTypes.join(", ")}`,
    "local"
  )
  .option(
    "-e, --extensions <extensions>",
    "comma-separated list of extensions to generate",
    extensionTypes.join(",")
  )
  .option(
    "--bare",
    "don't create any extensions. Overrides --extensions",
    false
  )
  .option(
    "--name <name>",
    "name of your app. It will be placed on your Desktop",
    `nightly-app-${today}`
  )
  .option(
    "-p, --package-manager <packageManager>",
    `package manager to be used: ${packageManagers.join(", ")}`
  )
  .option(
    "-t, --template <template>",
    "template to be used for the app",
  )
  .option(
    "-f, --flavor <flavor>",
    "flavor to be used for the template",
  )
  .option("--cleanup", "delete temp app afterwards", false)
  .option("--deploy", "deploy the app to Shopify", false)
  .option("--config-as-code", "enable config as code", false)
  .action(async (options) => {
    // helpers
    const log = (message) => {
      console.log(`\r\n🧪 ${message}`);
    };

    // main
    let shopifyExec;
    let nodePackageManager;
    let defaultOpts = { stdio: "inherit" };
    let extensions = options.bare
      ? new Set()
      : new Set(options.extensions.split(","));

    const appName = options.name;
    const template = options.template || "remix";
    const flavor = options.flavor || "javascript";
    const appPath = path.join(homeDir, "Desktop", appName);

    switch (options.packageManager) {
      case "npm":
      case "yarn":
      case "pnpm":
      case "bun":
        nodePackageManager = options.packageManager;
        break;
      case undefined:
        if (options.install === "local") {
          nodePackageManager = "pnpm";
        } else if (options.install === "nightly" || options.install === "experimental") {
          nodePackageManager = "npm";
        }
        break;
      default:
        log(
          `Invalid package manager: ${
            options.packageManager
          }. Must be one of ${packageManagers.join(", ")}.`
        );
        process.exit(1);
    }

    const nodeExec = async (commands, args = [], options = {}) => {
      switch (nodePackageManager) {
        case "yarn":
        case "pnpm":
        case "bun":
          return execa(
            nodePackageManager,
            ["run", ...commands, ...args],
            options
          );
          break;
        case "npm":
          return execa("npm", ["run", ...commands, "--", ...args], options);
      }
    };

    const appExec = async (command, args, options = {}) => {
      const defaults = { cwd: appPath, stdio: "inherit" };
      log(`Running \`${command} ${args.join(" ")}\``);
      await execa(command, args, { ...defaults, ...options });
    };

    const appNodeExec = async (commands, args = [], options = {}) => {
      const defaults = { cwd: appPath, stdio: "inherit" };
      log(`Running '${commands.join(" ")}' with args '${args.join(" ")}'`);
      await nodeExec(commands, args, { ...defaults, ...options });
    };

    const appDev = async () => {
      await appExec(nodePackageManager, ["run", "dev"]);
    };

    const generateExtension = async (args, options = {}) => {
      await appNodeExec(["generate", "extension"], args, options);
    };

    if (fs.existsSync(appPath)) {
      const rl = readline.createInterface({ input, output });
      const answer = await rl.question(
        `\r\n🙋 I've found an app in '${appPath}'. Should I remove it and keep going? (Y/n)`
      );
      rl.close();

      if (answer.toLowerCase() === "y" || answer === "") {
        log(`Removing app in '${appPath}'...`);
        fs.rmSync(appPath, { recursive: true });
      } else {
        process.exit(0);
      }
    }

    let initArgs = [`--template=${template}`, `--name=${appName}`, `--path=${path.join(homeDir, "Desktop")}`];
    if (template === 'remix') initArgs.push(`--flavor=${flavor}`);

    switch (options.install) {
      case "local":
        log("Building latest release...");
        await nodeExec(["build"]);

        log(`Creating new app in '${appPath}'...`);
        initArgs.push("--local");
        initArgs.push(`--package-manager=${nodePackageManager}`);
        await nodeExec(["create-app"], initArgs, defaultOpts);

        // there are some bugs with lockfiles and local references
        ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"].forEach((lockFile) => {
          let lockFilePath = path.join(appPath, lockFile);
          if (fs.existsSync(lockFilePath)) {
            fs.rmSync(lockFilePath);
          }
        });

        break;
      case "nightly":
      case "experimental":
        log(`Creating new app in '${appPath}'...`);
        switch (nodePackageManager) {
          case "yarn":
            // yarn doesn't support 'create @shopify/app@nightly' syntax
            await execa(
              "npm",
              [
                "init",
                `@shopify/app@${options.install}`,
                "--package-manager=yarn",
                "--",
                ...initArgs
              ],
              defaultOpts
            );
            break;
          case "pnpm":
          case "bun":
            await execa(
              nodePackageManager,
              [
                "create",
                `@shopify/app@${options.install}`,
                ...initArgs
              ],
              defaultOpts
            );
            break;
          case "npm":
            await execa(
              "npm",
              [
                "init",
                `@shopify/app@${options.install}`,
                "--",
                ...initArgs
              ],
              defaultOpts
            );
        }
        break;
      default:
        log(
          `Invalid installation type: ${
            options.install
          }. Must be one of ${installationTypes.join(", ")}.`
        );
        process.exit(1);
    }

    // on windows pnpm sets the wrong paths, rerunning install fixes it
    log("Making sure node is setup correctly...");
    await appExec(nodePackageManager, ["install"]);

    if (options.configAsCode) {
      log("Enabling config as code...");
      await appNodeExec(["shopify", "app", "config", "link"], []);
    }

    if (extensions.has("ui")) {
      log("Generating UI extension...");
      await generateExtension([
        "--template=subscription_ui",
        "--name=sub-ui-ext",
        "--flavor=vanilla-js",
      ]);
      await appDev();
    }

    if (extensions.has("theme")) {
      // set Ruby version inside app or CLI2 will complain
      fs.writeFileSync(path.join(appPath, ".ruby-version"), "3.2.1");

      log("Generating Theme App extension...");
      await generateExtension([
        "--template=theme_app_extension",
        "--name=theme-app-ext",
      ]);
      await appDev();
    }

    if (extensions.has("function")) {
      log("Generating JS function...");
      const functionDir = path.join(appPath, "extensions", "prod-discount-fun");
      await generateExtension([
        "--template=product_discounts",
        "--name=prod-discount-fun",
        "--flavor=typescript",
      ]);
      await appExec(nodePackageManager, ["run", "build"], { cwd: functionDir });
      const separator = nodePackageManager === "npm" ? "--" : "";
      const previewProcess = execa(nodePackageManager, ["run", "preview", separator, "--export", "run"], {
        cwd: functionDir,
        stdout: "inherit",
      });
      Readable.from(['{"discountNode":{"metafield":null}}']).pipe(
        previewProcess.stdin
      );
      await previewProcess;
    }

    if (options.deploy) {
      log("Deploying your app...");
      await appNodeExec(["shopify", "app", "deploy"], ["-f"]);
    }

    if (options.cleanup) {
      log(`Removing app in '${appPath}'...`);
      fs.rmSync(appPath, { recursive: true });
    }

    log("All done! 🎉");
  });

// run it
program.parse();

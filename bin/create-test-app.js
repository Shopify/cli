#! /usr/bin/env node

import { createRequire } from "module"
import { fileURLToPath } from "url"
import { Readable } from "stream"
import execa from "execa"
import path from "path"
import os from "os"
import fs from "fs"

const require = createRequire(import.meta.url)
const { program } = require("commander")

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const homeDir = os.homedir()
const today = new Date().toISOString().split("T")[0]
const appName = `nightly-app-${today}`
const appPath = path.join(homeDir, "Desktop", appName)

const installationTypes = ["local", "nightly"]

program
  .description("Creates a test app.")
  .requiredOption(
    "-i, --install <type>",
    `installation type: ${installationTypes.join(", ")}`
  )
  .option(
    "--no-cleanup",
    "keep temporary app around"
  )
  .action(async (options) => {
    let shopifyExec
    let defaultOpts = { stdio: "inherit" }

    switch (options.install) {
      case "local":
        log("Building latest release...")
        await execa("pnpm", ["build"])

        log(`Creating new app in ${appPath}...`)
        await execa(
          "pnpm",
          [
            "create-app",
            "--local",
            "--template=node",
            `--name=${appName}`,
            `--path=${path.join(homeDir, "Desktop")}`,
          ],
          defaultOpts
        )

        // there is a bug with pnpm and local references on windows:
        // https://github.com/pnpm/pnpm/issues/5510
        if (os.platform() == "win32") {
          fs.rmSync(path.join(appPath, "pnpm-lock.yaml"))
        }
        break
      case "nightly":
        log(`Creating new app in ${appPath}...`)
        await execa(
          "pnpm",
          [
            "create",
            "@shopify/app@nightly",
            "--template=node",
            `--name=${appName}`,
            `--path=${path.join(homeDir, "Desktop")}`,
          ],
          defaultOpts
        )

        break
      default:
        log(`Invalid installation type: ${options.install}. Must be one of ${installationTypes.join(", ")}.`)
        process.exit(1)
    }

    log("Setting Ruby version in app...")
    fs.writeFileSync(path.join(appPath, ".ruby-version"), "3.2.1")

    log("Running the app...")
    await appExec("pnpm", ["install"])
    await pnpmDev()

    log("Generating UI extension...")
    await appExec("pnpm", [
      "generate",
      "extension",
      "--type=subscription_ui",
      "--name=sub-ui-ext",
      "--template=vanilla-js",
    ])
    await pnpmDev()

    log("Generating Theme App extension...")
    await appExec("pnpm", [
      "generate",
      "extension",
      "--type=theme_app_extension",
      "--name=theme-app-ext",
    ])
    const fixtureAppTheme = path.join(
      __dirname,
      "..",
      "fixtures",
      "app",
      "extensions",
      "theme-extension"
    )

    const filesToCopy = [
      path.join("blocks", "star_rating.liquid"),
      path.join("snippets", "stars.liquid"),
      path.join("assets", "thumbs-up.png"),
      path.join("locales", "en.default.json"),
    ]
    filesToCopy.forEach((file) => {
      fs.copyFileSync(
        path.join(fixtureAppTheme, file),
        path.join(appPath, "extensions", "theme-app-ext", file)
      )
    })

    const gitkeepFolders = [ "assets", "blocks", "locales", "snippets" ]
    gitkeepFolders.forEach((folder) => {
      fs.rmSync(path.join(appPath, "extensions", "theme-app-ext", folder, ".gitkeep"))
    })

    await pnpmDev()

    log("Generating JS function...")
    const functionDir = path.join(appPath, "extensions", "prod-discount-fun")
    await appExec("pnpm", [
      "generate",
      "extension",
      "--type=product_discounts",
      "--name=prod-discount-fun",
      "--template=typescript",
    ])
    await appExec("pnpm", ["build"], { cwd: functionDir })
    const previewProcess = execa("pnpm", ["preview"], {
      cwd: functionDir,
      stdout: "inherit",
    })
    Readable.from(['{"discountNode":{"metafield":null}}']).pipe(previewProcess.stdin)
    await previewProcess

    log("Deploying your app...")
    await appExec("pnpm", ["shopify", "app", "deploy"])

    if (!options.noCleanup) {
      log(`Removing app in '${appPath}'...`)
      fs.rmSync(appPath, { recursive: true })
    }

    log("All done! 🎉")
  })

// run it
program.parse()

// helpers
function log(message) {
  console.log(`\r\n🧪 ${message}`)
}

async function appExec(command, args, options = {}) {
  const defaults = { cwd: appPath, stdio: "inherit" }
  await execa(command, args, { ...defaults, ...options })
}

async function pnpmDev() {
  try {
    await appExec("pnpm", ["run", "dev"])
  } catch (error) {}
}

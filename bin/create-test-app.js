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
const extensionTypes = ["ui", "theme", "function"]

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
    "--cleanup",
    "delete temp app afterwards",
    false
  )
  .option(
    "--deploy",
    "deploy the app to Shopify",
    false
  )
  .action(async (options) => {
    let shopifyExec
    let defaultOpts = { stdio: "inherit" }
    let extensions = new Set(options.extensions.split(","))

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
        await appExec("pnpm", ["install"])
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

    if (extensions.length === extensionTypes.length) {
      log("Running the app...")
      await pnpmDev()
    }

    if (extensions.has("ui")) {
      log("Generating UI extension...")
      await appExec("pnpm", [
        "generate",
        "extension",
        "--type=subscription_ui",
        "--name=sub-ui-ext",
        "--template=vanilla-js",
      ])
      await pnpmDev()
    }

    if (extensions.has("theme")) {
      // set Ruby version inside app or CLI2 will complain
      fs.writeFileSync(path.join(appPath, ".ruby-version"), "3.2.1")

      log("Generating Theme App extension...")
      await appExec("pnpm", [
        "generate",
        "extension",
        "--type=theme_app_extension",
        "--name=theme-app-ext",
      ])
      await pnpmDev()
    }

    if (extensions.has("function")) {
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
    }

    if (options.deploy) {
      log("Deploying your app...")
      await appExec("pnpm", ["shopify", "app", "deploy", "-f"])
    }

    if (options.cleanup) {
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

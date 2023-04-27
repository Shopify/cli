#! /usr/bin/env node

import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
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
    // helpers
    const log = (message) => {
      console.log(`\r\n🧪 ${message}`)
    }

    const appExec = async (command, args, options = {}) => {
      const defaults = { cwd: appPath, stdio: "inherit" }
      await execa(command, args, { ...defaults, ...options })
    }

    const pnpmDev = async () => {
      try {
        await appExec("pnpm", ["run", "dev"])
      } catch (error) {}
    }

    // main
    let shopifyExec
    let defaultOpts = { stdio: "inherit" }
    let extensions = options.bare ? new Set() : new Set(options.extensions.split(","))

    const appName = options.name
    const appPath = path.join(homeDir, "Desktop", appName)

    switch (options.install) {
      case "local":
        log("Building latest release...")
        await execa("pnpm", ["build"])

        if (fs.existsSync(appPath)) {
          const rl = readline.createInterface({ input, output })
          const answer = await rl.question(`\r\n🙋‍♀️ I've found an app in ${appPath}. Should I remove it and keep going? (Y/n)`);
          rl.close();

          if (answer.toLowerCase() === 'y' || answer === '') {
            log(`Removing app in '${appPath}'...`)
            fs.rmSync(appPath, { recursive: true })
          } else {
            process.exit(0)
          }
        }

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

    // on windows pnpm sets the wrong paths, rerunning install fixes it
    log("Making sure pnpm is setup correctly")
    await appExec("pnpm", ["install"])

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

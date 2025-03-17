#!/usr/bin/env node
process.removeAllListeners('warning');

// ES Modules
import {findUp} from "find-up"
import {createHash} from 'node:crypto'
import {createRequire} from 'module'
import {fileURLToPath} from "node:url"
import * as path from "pathe"
import fetch from 'node-fetch'
import glob from 'fast-glob';
import {Liquid} from 'liquidjs'

// CJS Modules
const require = createRequire(import.meta.url)
const {readFile, mkdir, lstat, copy, outputFile, pathExists, rm} = require('fs-extra')
const {program} = require('commander')
const colors = require('ansi-colors')
import {withOctokit} from './github-utils.js'

const packagingDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packaging")

program
  .description('Packages the CLI for distribution through package managers')
  .requiredOption('-p, --open-pr', 'when passed it opens a PR in the https://github.com/shopify/homebrew-shopify repository', true)
  .action(async (options) => {
    // Constants
    const version = await versionToRelease()
    const templateVersion = getTemplateVersion(version)
    console.log(`${colors.green(colors.bold("Version to package:"))} ${version}`)
    const outputDirectory = path.join(packagingDirectory, templateVersion, "dist")
    console.log(`${colors.green(colors.bold("Output directory:"))} ${outputDirectory}`)
    const homebrewVariables = await getHomebrewVariables(version)
    console.log(`We'll populate the Homebrew formula with the following content:`)
    console.log(homebrewVariables)

    // Create formulas
    await recursiveDirectoryCopy(path.join(packagingDirectory, templateVersion, "src"), outputDirectory, homebrewVariables)

    if (options.openPr) {
      console.log(`Opening a PR in shopify/homebrew-shopify to update the formula ${version}`)

      const files = {}
      switch (templateVersion) {
        case "3":
          files["shopify-cli.rb"] = (await readFile(path.join(outputDirectory, "shopify-cli.rb"))).toString()
          files["shopify-cli@3.rb"] = (await readFile(path.join(outputDirectory, "shopify-cli@3.rb"))).toString()
          break
        case "pre":
          files["shopify-cli-pre.rb"] = (await readFile(path.join(outputDirectory, "shopify-cli-pre.rb"))).toString()
          break
        case "nightly":
          files["shopify-cli-nightly.rb"] = (await readFile(path.join(outputDirectory, "shopify-cli-nightly.rb"))).toString()
          break
        default:
          throw new Error(`Unrecognized template version string ${templateVersion}`)
      }

      await withOctokit("shopify", async (octokit) => {
        const response = await octokit
          .createPullRequest({
          owner: "shopify",
          repo: "homebrew-shopify",
          title: `Shopify CLI ${version}`,
          body: `We are updating the formula to point to the recently released version of the Shopify CLI [${version}](https://www.npmjs.com/package/@shopify/cli/v/${version})`,
          head: `shopify-cli-${version}`,
          base: "master",
          update: true,
          forceFork: false,
          changes: [
            {
              files,
              commit: `Update Shopify CLI 3 formula to install the version ${version}`,
            },
          ],
        })
        if (["pre", "nightly"].includes(templateVersion)) {
          // Merge the PR immediately if we're releasing a pre or nightly version
          octokit.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
            owner: "Shopify",
            repo: "homebrew-shopify",
            pull_number: response.data.number,
          })
        } else {
          // When releasing a minor version, mandate a manual review of the PR before merge
          console.log(`${colors.green(colors.bold("PR opened:"))} ${response.data.html_url}`)
        }
      })
    }
  })

program.parse()

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp("packages/cli-kit/package.json", {type: "file"})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

function getTemplateVersion(version) {
  if (version.includes("pre")) return "pre"
  if (version.includes("nightly")) return "nightly"
  if (version.match(/^3\.\d+\.\d+$/)) return "3"
  throw `Unrecognized version string ${version}`
}

async function getHomebrewVariables(cliVersion) {
  const [cliTarball, cliSha] = await getTarballAndShaForPackage('@shopify/cli', cliVersion)
  return {cliTarball, cliSha}
}

async function getTarballAndShaForPackage(pkg, cliVersion) {
  const tarball = await getTarballForPackage(pkg, cliVersion)
  const sha = await getSha256ForTarball(tarball)
  return [tarball, sha]
}

async function getTarballForPackage(pkg, cliVersion) {
  let retryCount = 1
  while (true) {
    const response = await fetch(`https://registry.npmjs.com/${pkg}`)
    const npmPackage = (await response.json()).versions[cliVersion]
    if (npmPackage) return npmPackage.dist.tarball
    if (retryCount++ < 10) {
      console.log(`${pkg} v${cliVersion} not found in NPM registry. Retrying in 5 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    } else {
      throw new Error(`${pkg} v${cliVersion} not found in NPM registry`)
    }
  }
}

async function getSha256ForTarball(url) {
  const hash = createHash('sha256').setEncoding('hex')
  const response = await fetch(url)
  const stream = response.body.pipe(hash)
  await new Promise((resolve) => stream.on('finish', resolve))
  return hash.read()
}

async function recursiveDirectoryCopy(from, to, data) {
  console.log(`Generating the formula into ${to}`)

  // Must go up to `packaging` dir so nightly and pre can find the primary formula template
  const engine = new Liquid({root: path.join(from, '../..')})
  const templateFiles = await glob(path.join(from, '**/*'), {dot: true})

  if (await pathExists(to)) {
    await rm(to, {recursive: true})
  }
  await mkdir(to)

  const sortedTemplateFiles = templateFiles
    .map((path) => path.split('/'))
    .sort((lhs, rhs) => (lhs.length < rhs.length ? 1 : -1))
    .map((components) => components.join('/'))

  for (const templateItemPath of sortedTemplateFiles) {
    const outputPath = await engine.render(engine.parse(path.join(to, path.relative(from, templateItemPath))), data)
    const isDirectory = (await lstat(templateItemPath)).isDirectory()
    if (isDirectory) {
      if (!await pathExists(templateItemPath)) {
        await mkdir(outputPath)
      }
    } else if (templateItemPath.endsWith('.liquid')) {
      if (!await pathExists(path.dirname(outputPath))) {
        await mkdir(path.dirname(outputPath))
      }
      const content = (await readFile(templateItemPath)).toString()
      const contentOutput = await engine.render(engine.parse(content), data)

      const outputPathWithoutLiquid = outputPath.replace('.liquid', '')

      await copy(templateItemPath, outputPathWithoutLiquid)
      await outputFile(outputPathWithoutLiquid, contentOutput)
    } else {
      await copy(templateItemPath, outputPath)
    }
  }
  console.log(`The formula has been generated in ${to}`)
}

#!/usr/bin/env node

import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

import {findUp} from 'find-up'
import * as path from 'pathe'

import {withOctokit} from './github-utils.js'

const require = createRequire(import.meta.url)
const {readFile, readdir, stat} = require('fs-extra')

async function createPR() {
  const version = await versionToRelease()

  const docsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs-shopify.dev")
  const syncPaths = [
    {
      source: path.join(docsDirectory, "generated/generated_docs_data_v2.json"),
      target: "areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli/generated_docs_data_v2.json",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/sidebar.yml"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/sidebar.yml",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/app"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/app",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/theme"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/theme",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/hydrogen"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/hydrogen",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/store"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/store",
    },
    {
      source: path.join(docsDirectory, "content/api/shopify-cli/general-commands"),
      target: "areas/platforms/shopify-dev/content/api/shopify-cli/general-commands",
    },
    {
      source: path.join(docsDirectory, "examples/templated-apis/shopify-cli"),
      target: "areas/platforms/shopify-dev/db/examples/templated-apis/shopify-cli",
      ignoreDeletedFile: (file) =>
        file.startsWith("areas/platforms/shopify-dev/db/examples/templated-apis/shopify-cli/index/"),
    },
  ]

  await withOctokit("shop", async (octokit) => {
    const files = await filesForShopifyDevDocs(octokit, syncPaths)
    const response = await octokit
      .createPullRequest({
        owner: "shop",
        repo: "world",
        title: `[CLI] Update docs for version: ${version}`,
        body: `We are updating the CLI documentation with the contents of the recently released version of the Shopify CLI [${version}](https://www.npmjs.com/package/@shopify/cli/v/${version})`,
        head: `shopify-cli-${version}`,
        base: "main",
        update: true,
        forceFork: false,
        changes: [
          {
            files,
            commit: `Update Shopify CLI documentation to version ${version}`,
          },
        ],
        createWhenEmpty: false,
      })

    if (response) {
      console.log(`PR URL: https://github.com/shop/world/pull/${response.data.number}`)
    } else {
      console.log("No changes detected, PR not created.")
    }
  })
}

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp("packages/cli-kit/package.json", {type: "file"})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

async function filesForShopifyDevDocs(octokit, syncPaths) {
  const files = {}

  await Promise.all(
    syncPaths.map(async ({source, target, ignoreDeletedFile}) => {
      await addFiles(files, source, target)
      if (!(await isFile(source))) {
        await addDeletedFiles(octokit, files, target, ignoreDeletedFile)
      }
    }),
  )

  return files
}

async function addFiles(files, sourceDirectory, targetDirectory) {
  if (await isFile(sourceDirectory)) {
    files[targetDirectory] = (await readFile(sourceDirectory)).toString()
    return
  }

  let entries
  try {
    entries = await readdir(sourceDirectory, {withFileTypes: true})
  } catch (error) {
    if (error.code === "ENOENT") return
    throw error
  }

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDirectory, entry.name)
      const targetPath = path.join(targetDirectory, entry.name)

      if (entry.isDirectory()) {
        await addFiles(files, sourcePath, targetPath)
      } else if (entry.isFile()) {
        files[targetPath] = (await readFile(sourcePath)).toString()
      }
    }),
  )
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

async function addDeletedFiles(octokit, files, targetDirectory, ignoreDeletedFile = () => false) {
  const existingFiles = await shopifyDevFiles(octokit, targetDirectory)
  existingFiles.forEach((file) => {
    if (!(file in files) && !ignoreDeletedFile(file)) {
      files[file] = null
    }
  })
}

async function shopifyDevFiles(octokit, targetDirectory) {
  const {data} = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner: "shop",
    repo: "world",
    tree_sha: `main:${targetDirectory}`,
    recursive: "true",
  })

  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => `${targetDirectory}/${item.path}`)
}

await createPR()

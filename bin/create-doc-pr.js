#!/usr/bin/env node

import * as path from "pathe"
import {fileURLToPath} from "node:url"
import {createRequire} from 'node:module'
import {findUp} from "find-up"
import {withOctokit} from './github-utils.js'

const require = createRequire(import.meta.url)
const {readFile} = require('fs-extra')

async function createPR() {

  const version = await versionToRelease()

  const generatedDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs-shopify.dev/generated")

  const fileNames = ['generated_category_pages.json', 'generated_docs_data.json', 'generated_static_pages.json']

  const files = {}
  for (const fileName of fileNames) {
    files[`db/data/docs/templated_apis/shopify_cli/${fileName}`] = (await readFile(path.join(generatedDirectory, fileName))).toString()
  }

  await withOctokit("shopify", async (octokit) => {
    const response = await octokit
      .createPullRequest({
        owner: "shopify",
        repo: "shopify-dev",
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
      console.log(`PR URL: https://github.com/shopify/shopify-dev/pull/${response.data.number}`)
    } else {
      console.log("No changes detected, PR not created.")
    }
  })
}

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp("packages/cli-kit/package.json", {type: "file"})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

await createPR()

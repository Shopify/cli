#!/usr/bin/env node

import {fileURLToPath} from "node:url"
import {createRequire} from 'node:module'

import * as path from "pathe"
import {findUp} from "find-up"

import {createWorldPullRequest} from './gitstream-utils.js'

const require = createRequire(import.meta.url)
const {readFile} = require('fs-extra')

async function createPR() {

  const version = await versionToRelease()

  const generatedDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs-shopify.dev/generated")

  const fileNames = ['generated_docs_data_v2.json']

  const files = {}
  for (const fileName of fileNames) {
    files[`areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli/${fileName}`] = (await readFile(path.join(generatedDirectory, fileName))).toString()
  }

  const pullRequest = await createWorldPullRequest({
    branch: `shopify-cli-${version}`,
    base: "main",
    title: `[CLI] Update docs for version: ${version}`,
    body: `We are updating the CLI documentation with the contents of the recently released version of the Shopify CLI [${version}](https://www.npmjs.com/package/@shopify/cli/v/${version})`,
    commitMessage: `Update Shopify CLI documentation to version ${version}`,
    files,
  })

  if (pullRequest) {
    console.log(`PR URL: ${pullRequest.url}`)
  } else {
    console.log("No changes detected, PR not created.")
  }
}

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp("packages/cli-kit/package.json", {type: "file"})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

await createPR()

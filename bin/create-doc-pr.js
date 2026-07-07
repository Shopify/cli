#!/usr/bin/env node

import {fileURLToPath} from "node:url"
import {createRequire} from 'node:module'
import {homedir} from 'node:os'
import {spawn} from 'node:child_process'

import * as path from "pathe"
import {findUp} from "find-up"

import {withOctokit} from './github-utils.js'

const require = createRequire(import.meta.url)
const {readFile, outputFile, ensureDir, remove, pathExists} = require('fs-extra')

const WORLD_OWNER = "shop"
const WORLD_REPO = "world"
const WORLD_BASE_BRANCH = "main"
const WORLD_CHECKOUT = process.env.WORLD_CHECKOUT ?? path.join(homedir(), "world/trees/root/src")

async function createPR() {

  const version = await versionToRelease()
  const branch = `shopify-cli-${version}`
  const title = `[CLI] Update docs for version: ${version}`
  const body = `We are updating the CLI documentation with the contents of the recently released version of the Shopify CLI [${version}](https://www.npmjs.com/package/@shopify/cli/v/${version})`

  const generatedDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs-shopify.dev/generated")

  const fileNames = ['generated_docs_data_v2.json']

  const files = {}
  for (const fileName of fileNames) {
    files[`areas/platforms/shopify-dev/db/data/docs/templated_apis/shopify_cli/${fileName}`] = (await readFile(path.join(generatedDirectory, fileName))).toString()
  }

  await withOctokit(WORLD_OWNER, async (octokit) => {
    const changed = await pushDocsThroughGitstream(octokit, {
      branch,
      files,
      commit: `Update Shopify CLI documentation to version ${version}`,
    })

    if (!changed) {
      console.log("No changes detected, PR not created.")
      return
    }

    const response = await createOrUpdatePullRequest(octokit, {
      branch,
      title,
      body,
    })

    if (response) {
      console.log(`PR URL: https://github.com/shop/world/pull/${response.data.number}`)
    }
  })
}

async function versionToRelease() {
  const cliKitPackageJsonPath = await findUp("packages/cli-kit/package.json", {type: "file"})
  return JSON.parse(await readFile(cliKitPackageJsonPath)).version
}

async function pushDocsThroughGitstream(octokit, {branch, files, commit}) {
  await ensureWorldCheckout()
  await ensureGitstreamRemote()
  await run("git", ["fetch", "origin", WORLD_BASE_BRANCH], {cwd: WORLD_CHECKOUT})
  await ensureBranchAvailableInGitstream(octokit, branch)

  const existingBranch = await gitstreamBranchExists(branch)
  const startPoint = existingBranch ? "FETCH_HEAD" : `origin/${WORLD_BASE_BRANCH}`
  if (existingBranch) {
    await run("git", ["fetch", "origin", `refs/heads/${branch}`], {cwd: WORLD_CHECKOUT})
  }

  const worktreeName = `shopify-cli-doc-pr-${process.pid}-${Date.now()}`
  const worktreeRoot = path.join(homedir(), "world/trees", worktreeName)
  const worktreePath = path.join(worktreeRoot, "src")
  await ensureDir(worktreeRoot)

  try {
    await run("git", ["worktree", "add", "--detach", worktreePath, startPoint], {cwd: WORLD_CHECKOUT})

    for (const [filePath, content] of Object.entries(files)) {
      await outputFile(path.join(worktreePath, filePath), content)
    }

    const changedFiles = await run("git", ["status", "--porcelain", "--", ...Object.keys(files)], {cwd: worktreePath})
    if (!changedFiles.trim()) return false

    await run("git", ["add", "--", ...Object.keys(files)], {cwd: worktreePath})
    await run("git", ["commit", "-m", commit], {cwd: worktreePath})
    await run("git", ["push", "origin", `HEAD:refs/heads/${branch}`], {cwd: worktreePath})
    return true
  } finally {
    await run("git", ["worktree", "remove", "--force", worktreePath], {cwd: WORLD_CHECKOUT, reject: false})
    await remove(worktreeRoot)
  }
}

async function ensureWorldCheckout() {
  if (!await pathExists(path.join(WORLD_CHECKOUT, ".git"))) {
    throw new Error(`World checkout not found at ${WORLD_CHECKOUT}. Set WORLD_CHECKOUT to a shop/world checkout.`)
  }
}

async function ensureGitstreamRemote() {
  const origin = await run("git", ["remote", "get-url", "origin"], {cwd: WORLD_CHECKOUT})
  if (!origin.includes("gitstream.shopify.io/shop/world.git")) {
    throw new Error(`World checkout origin must point at Gitstream, got: ${origin.trim()}`)
  }
}

async function ensureBranchAvailableInGitstream(octokit, branch) {
  if (await gitstreamBranchExists(branch)) return
  if (!await githubBranchExists(octokit, branch)) return

  console.log(`${branch} exists on GitHub but not Gitstream. Syncing the ref into Gitstream.`)
  await run("/opt/dev/bin/dev", ["gitstream", "sync-github-ref", branch], {cwd: WORLD_CHECKOUT})
}

async function gitstreamBranchExists(branch) {
  const output = await run("git", ["ls-remote", "--heads", "origin", branch], {cwd: WORLD_CHECKOUT})
  return output.trim().length > 0
}

async function githubBranchExists(octokit, branch) {
  try {
    await octokit.rest.git.getRef({
      owner: WORLD_OWNER,
      repo: WORLD_REPO,
      ref: `heads/${branch}`,
    })
    return true
  } catch (error) {
    if (error.status === 404) return false
    throw error
  }
}

async function createOrUpdatePullRequest(octokit, {branch, title, body}) {
  const existingPulls = await octokit.rest.pulls.list({
    owner: WORLD_OWNER,
    repo: WORLD_REPO,
    state: "open",
    head: `${WORLD_OWNER}:${branch}`,
    base: WORLD_BASE_BRANCH,
  })

  if (existingPulls.data.length > 0) {
    const pull = existingPulls.data[0]
    const pullNumberParam = "pull_number"
    await octokit.rest.pulls.update({
      owner: WORLD_OWNER,
      repo: WORLD_REPO,
      [pullNumberParam]: pull.number,
      title,
      body,
      base: WORLD_BASE_BRANCH,
    })
    return {data: pull}
  }

  return octokit.rest.pulls.create({
    owner: WORLD_OWNER,
    repo: WORLD_REPO,
    title,
    body,
    head: branch,
    base: WORLD_BASE_BRANCH,
  })
}

function run(command, args, options = {}) {
  const {cwd, reject: shouldReject = true} = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: ["inherit", "pipe", "pipe"]})

    let output = ""
    let errorOutput = ""

    child.stdout.on("data", (data) => {
      process.stdout.write(data)
      output += data.toString()
    })

    child.stderr.on("data", (data) => {
      process.stderr.write(data)
      errorOutput += data.toString()
    })

    child.on("error", (error) => {
      if (shouldReject) {
        reject(error)
      } else {
        resolve("")
      }
    })

    child.on("close", (code) => {
      if (code !== 0 && shouldReject) {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}\n${errorOutput}`))
      } else {
        resolve(output)
      }
    })
  })
}

await createPR()

#!/usr/bin/env node

import {execFileSync} from 'node:child_process'
import {appendFileSync, readFileSync} from 'node:fs'
import {relative, resolve, sep} from 'node:path'

const [packageJsonPath, registryUrl] = process.argv.slice(2)

if (!packageJsonPath || !registryUrl) {
  throw new Error('Usage: resolve-package-publish-state.js <package-json-path> <registry-url>')
}

const githubOutput = process.env.GITHUB_OUTPUT

if (!githubOutput) {
  throw new Error('GITHUB_OUTPUT must be set')
}

const eventName = process.env.GITHUB_EVENT_NAME ?? 'unknown'
const gitPackageJsonPath = relative(process.cwd(), resolve(packageJsonPath)).split(sep).join('/')

if (gitPackageJsonPath.startsWith('../')) {
  throw new Error('The package.json must be inside the repository')
}

function readPackageJson(content) {
  const packageJson = JSON.parse(content)

  if (typeof packageJson.name !== 'string' || typeof packageJson.version !== 'string') {
    throw new Error(`${packageJsonPath} must have string name and version fields`)
  }

  return packageJson
}

function readPackageJsonAt(ref) {
  return readPackageJson(
    execFileSync('git', ['show', `${ref}:${gitPackageJsonPath}`], {
      encoding: 'utf8',
    }),
  )
}

function readPreviousPackageJson() {
  try {
    return readPackageJsonAt('HEAD~1')
  } catch {
    return undefined
  }
}

async function versionExists(packageJson) {
  const packageUrl = new URL(
    encodeURIComponent(packageJson.name),
    registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`,
  )
  const headers = {
    accept: 'application/vnd.npm.install-v1+json',
  }

  if (packageUrl.hostname === 'npm.shopify.io') {
    const cloudsmithToken = process.env.CLOUDSMITH_NPM_TOKEN_RO

    if (!cloudsmithToken) {
      throw new Error(`CLOUDSMITH_NPM_TOKEN_RO must be set to look up ${packageJson.name} in ${registryUrl}`)
    }

    headers.authorization = `Bearer ${cloudsmithToken}`
  }

  const response = await fetch(packageUrl, {
    headers,
    signal: AbortSignal.timeout(30_000),
  })

  if (response.status === 404) return false

  if (!response.ok) {
    throw new Error(
      `Registry lookup failed for ${packageJson.name} at ${packageUrl}: ${response.status} ${response.statusText}`,
    )
  }

  const metadata = await response.json()
  return Boolean(metadata.versions?.[packageJson.version])
}

function setOutput(name, value) {
  appendFileSync(githubOutput, `${name}=${value}\n`)
}

async function main() {
  const currentPackageJson = readPackageJson(readFileSync(packageJsonPath, 'utf8'))
  const previousPackageJson = readPreviousPackageJson()
  const bumped = previousPackageJson ? previousPackageJson.version !== currentPackageJson.version : true
  const manuallyDispatched = eventName === 'workflow_dispatch'
  const shouldCheckRegistry = bumped || manuallyDispatched
  const published = shouldCheckRegistry ? await versionExists(currentPackageJson) : false
  const shouldPublish = shouldCheckRegistry && !published
  const tag = `${currentPackageJson.name}@${currentPackageJson.version}`

  if (previousPackageJson) {
    console.log(
      bumped
        ? `${currentPackageJson.name} version bumped: ${previousPackageJson.version} -> ${currentPackageJson.version}`
        : `${currentPackageJson.name} version unchanged at ${currentPackageJson.version}`,
    )
  } else {
    console.log(`${currentPackageJson.name} has no HEAD~1 package.json to compare; treating version as changed`)
  }

  if (!shouldCheckRegistry) {
    console.log(`Skipping the registry lookup because ${tag} was not bumped by this commit.`)
  } else {
    console.log(
      published
        ? `${tag} already exists in ${registryUrl}; skipping publish.`
        : `${tag} is missing from ${registryUrl}; publish should run.`,
    )
  }

  setOutput('bumped', bumped)
  setOutput('published', published)
  setOutput('should_publish', shouldPublish)
  setOutput('name', currentPackageJson.name)
  setOutput('version', currentPackageJson.version)
  setOutput('tag', tag)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

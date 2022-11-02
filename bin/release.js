#!/usr/bin/env node
import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import {createRequire} from 'module'
import {readFileSync} from 'fs'
import {temporaryDirectoryTask} from 'tempy'

const require = createRequire(import.meta.url)
const {Octokit} = require('@octokit/rest')
const execa = require('execa')

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});
const supportedOSs = ['linux', 'windows', 'darwin']
const supportedArchitectures =  ['386', 'amd64']
const baseReleaseParams = {
    owner: 'shopify',
    repo: 'cli',
}
const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)
let cliVersion = getCliVersion()

const versionsMatrix = generateVersionsMatrix()
temporaryDirectoryTask(async (directory) => {
    const release = await createRelease()
    await Promise.all(versionsMatrix.map((version) => updloadReleaseAssetVersion(version, release, directory)))
})

function generateVersionsMatrix() {
    return supportedOSs.flatMap((os) => supportedArchitectures.map((arch) => {
        return {
            os,
            arch: (os === 'darwin' && arch === '386') ? 'arm64' : arch
        }
    }))
}

async function createRelease() {
    console.log(`Generating release for cli version: ${cliVersion}`)
    return await octokit.rest.repos.createRelease({
        ...baseReleaseParams,
        tag_name: cliVersion,
        name: cliVersion,
    })
}

function updloadReleaseAssetVersion(version, release, directory) {
    const baseVersionFileName = resolveBaseVersionFileName(version)
    const extensions = ['md5', 'gz']
    extensions.forEach(async (suffix) => {
        const versionFileName = `${baseVersionFileName}.${suffix}`
        const rawData = Buffer.from(readFileSync(join(directory, versionFileName)))
        console.log(`Uploading asset ${join(directory, versionFileName)}`)
        await octokit.rest.repos.uploadReleaseAsset({
            ...baseReleaseParams,
            release_id: release.data.id,
            name: versionFileName,
            data: rawData,
        })
    })
}

function getCliVersion() {
    const packageJson = JSON.parse(readFileSync(join(rootDirectory, 'packages/cli-kit/package.json')))
    return packageJson.version
}

function resolveBaseVersionFileName(version) {
    return `shopify-extensions-${version.os}-${version.arch}${version.os==='windows'?'.exe':''}`
}

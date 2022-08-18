#!/usr/bin/env node
import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import {createRequire} from 'module'
import {readFileSync} from 'fs'

const require = createRequire(import.meta.url)
const {Octokit} = require('@octokit/rest')
const execa = require('execa')

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});
const goos = ['linux', 'windows', 'darwin']
const goarch =  ['386', 'amd64']
const goPath = process.env.PATHGO
const baseReleaseParams = {
    owner: 'shopify',
    repo: 'cli',
}
const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)
const extensionsPath = join(rootDirectory, 'packages/ui-extensions-go-cli')
let cliVersion = getCliVersion()

const versionsMatrix = generateVersionsMatrix()
await Promise.all(versionsMatrix.map(generateVersion))
const release = await createRelease()
await Promise.all(versionsMatrix.map((version) => updloadReleaseAssetVersion(version, release)))
await Promise.all(versionsMatrix.map(cleanGeneratedVersion))

function generateVersionsMatrix() {
    var matrix = [];
    goos.forEach(function(os){
        goarch.forEach(function(arch){
            let finalArch = arch
            if (os === 'darwin' && arch === '386') {
                finalArch = 'arm64'
            }
            matrix.push({ os: os, arch: finalArch});
        });
    });
    return matrix
}

async function generateVersion(version) {
    await execa("yarn", ["package"], {cwd: extensionsPath, stdio: 'inherit', env: {GOOS: version.os, GOARCH: version.arch, PATHGO: goPath}}).catch((_) => {
        process.exit(1)
      })
}

async function createRelease() {
    return await octokit.rest.repos.createRelease({
        ...baseReleaseParams,
        tag_name: cliVersion,
        name: cliVersion,
    }).catch((error) => {
        console.error(`Error creating release ${cliVersion}. ${error.message}`)
        process.exit(1)
    })
}

function updloadReleaseAssetVersion(version, release) {
    const baseVersionFileName = resolveBaseVersionFileName(version)
    const extensions = ['md5', 'gz']
    extensions.forEach(async (suffix) => {
        const versionFileName = `${baseVersionFileName}.${suffix}`
        const rawData = Buffer.from(readFileSync(join(extensionsPath, versionFileName)))
        await octokit.rest.repos.uploadReleaseAsset({
            ...baseReleaseParams,
            release_id: release.data.id,
            name: versionFileName,
            data: rawData,
        }).catch((error) => {
            console.error(`Error uploading ${baseVersionFileName}.${suffix}`)
            process.exit(1)
        })
    })
}

function getCliVersion() {
    const packageJson = JSON.parse(readFileSync(join(rootDirectory, 'packages/cli-kit/package.json')))
    return packageJson.version
}

function cleanGeneratedVersion(version) {
    const baseVersionFileName = resolveBaseVersionFileName(version)
    const extensions = ['md5', 'gz']
    extensions.forEach(async (suffix) => {
        const versionFileName = `${baseVersionFileName}.${suffix}`
        await execa("rm", ["-fr", versionFileName], {cwd: extensionsPath, stdio: 'inherit', env: {GOOS: version.os, GOARCH: version.arch, PATHGO: goPath}}).catch((_) => {
            console.log(`Problems deleting ${versionFileName}`)
          })
    })
}

function resolveBaseVersionFileName(version) {
    return `shopify-extensions-${version.os}-${version.arch}${version.os==='windows'?'.exe':''}`
}

#!/usr/bin/env node

import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import {createHash} from 'crypto'
import {createGzip} from 'node:zlib'
import {pipeline} from 'node:stream'
import {promisify} from 'node:util'

import {createRequire} from 'module'
import { writeFile } from 'fs'
import { gzip } from 'zlib'
const require = createRequire(import.meta.url)
const { readSync, openSync, closeSync, writeSync, createWriteStream, createReadStream } = require('fs-extra')

const execa = require('execa')

const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)

const os = process.env.GOOS
const arch = process.env.GOARCH
if (!os) {
    console.error('Requires GOOS to be set')
    process.exit(1)
}

if (!arch) {
    console.error('Requires GOARCH to be set')
    process.exit(1)
}

const executableName = (os === "windows") ? "shopify-extensions.exe" : "shopify-extensions"
const canonicalName = (os === "windows") ? `shopify-extensions-${os}-${arch}.exe` : `shopify-extensions-${os}-${arch}`

console.log('Run code generation')
await execa("go", ["generate"], {cwd: rootDirectory, stdio: 'inherit'})

console.log('Build executable')
await execa("go", ["build", "-o", executableName], {cwd: rootDirectory, stdio: 'inherit'})

const executablePath = join(rootDirectory, executableName)

const md5FilePath = join(rootDirectory,`${canonicalName}.md5`)
console.log(md5FileSync(executablePath))
writeToFile(md5FileSync(executablePath), md5FilePath)

const canonicalPath = join(rootDirectory, canonicalName)
gzipFile(executablePath, canonicalPath)

function md5FileSync (path) {
    const BUFFER_SIZE = 8192

    const fd = openSync(path, 'r')
    const hash = createHash('md5')
    const buffer = Buffer.alloc(BUFFER_SIZE)

    try {
      let bytesRead

      do {
        bytesRead = readSync(fd, buffer, 0, BUFFER_SIZE)
        hash.update(buffer.slice(0, bytesRead))
      } while (bytesRead === BUFFER_SIZE)
    } finally {
      closeSync(fd)
    }

    return hash.digest('hex')
}

function writeToFile (content, path) {
    const fd = openSync(path, 'a+')
    try {
        writeSync(fd, content, 0, 'utf8');
    } finally {
        closeSync(fd)
      }
}

function gzipFile(sourcePath, targetPath) {
    const gzFilePath = `${targetPath}.gz`

    const gzip = createGzip()
    const source = createReadStream(sourcePath)
    const destination = createWriteStream(gzFilePath)

    pipeline(source, gzip, destination, (err) => {
      if (err) {
        console.error('An error occurred:', err)
        process.exit(1)
      }
    })
}

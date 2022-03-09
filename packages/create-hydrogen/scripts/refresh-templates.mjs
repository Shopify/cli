import {fileURLToPath} from 'url'

import {resolve, relative, dirname, sep} from 'pathe'
import simpleGit from 'simple-git'
import rimraf from 'rimraf'
import glob from 'glob'
import fs from 'fs-extra'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tempPath = resolve(__dirname, '../templates/tmp')
const repo = 'git@github.com:Shopify/hydrogen/examples'

;(async () => {
  const {subDirectory = '', ssh} = parseRepoUrl(repo)

  rimraf.sync(tempPath, {force: true})

  await simpleGit().clone(ssh, tempPath, ['--depth=1'])

  const examplesDirectory = [tempPath, subDirectory]
  const globPath = [...examplesDirectory, '*'].join(sep)

  glob(
    globPath,
    {
      dot: true,
    },
    (globErr, files) => {
      if (globErr) {
        return console.error(globErr)
      }

      files.forEach((file) => {
        const dest = file.replace(`/tmp/${subDirectory}`, '')
        const src = file.replace('/tmp', __dirname)

        process(file, dest, ['.stackblitzrc'])
      })

      rimraf.sync(tempPath, {force: true})
    },
  )
})()

function parseRepoUrl(src) {
  const match =
    /^(?:(?:https:\/\/)?([^:/]+\.[^:/]+)\/|git@([^:/]+)[:/]|([^/]+):)?([^/\s]+)\/([^/\s#]+)(?:((?:\/[^/\s#]+)+))?(?:\/)?(?:#(.+))?/.exec(
      src,
    )

  if (!match) {
    throw new Error(`Invalid git url: ${src}`)
  }

  const site = match[1] || match[2] || match[3] || 'github'
  const user = match[4]
  const name = match[5].replace(/\.git$/, '')
  const subDirectory = match[6].slice(1)
  const ref = match[7] || 'HEAD'

  const ssh = `git@${site}:${user}/${name}`

  return {site, user, name, ref, subDirectory, ssh}
}

const TRANSFORM_MAP = {
  'package.json': (src) => {
    const json = JSON.parse(src)

    json.name = '{{name}}'
    json.author = '{{author}}'
    json.dependencies['@shopify/cli'] = '{{shopify_cli_version}}'
    json.dependencies['@shopify/hydrogen'] = '{{hydrogen_version}}'

    return JSON.stringify(json, null, 2)
  },
}

function process(src, dest, skipFiles = []) {
  const key = src.split(sep).pop()

  const transform = TRANSFORM_MAP[key]

  if (transform) {
    log('transforming', src)

    const contents = fs.readFileSync(src, 'utf8')
    const result = transform(contents)

    fs.writeFileSync(`${dest}.liquid`, result)
    return
  }

  if (skipFiles.some((file) => src.includes(file))) {
    log('skipping', src)
    return
  }

  const stat = fs.statSync(src)

  if (stat.isDirectory()) {
    processDirectory(src, dest, skipFiles)
  } else {
    log('copying', src, dest)

    fs.copyFileSync(src, dest)
  }
}

function processDirectory(srcDir, destDir, skipFiles = []) {
  fs.mkdirSync(destDir, {recursive: true})

  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    process(srcFile, destFile, skipFiles)
  }
}

function log(action, src, dest) {
  console.log(`${action} • ${relative(tempPath, src)}`)
  if (dest) {
    console.log(`      ↳ • ${relative(tempPath, dest)}`)
  }
  console.log('')
}

import {file, http, path, system} from '@shopify/cli-kit'
import {createHash} from 'node:crypto'

async function tarballForPackage(pkg, cliVersion) {
  const response = await http.fetch(`https://registry.npmjs.com/${pkg}`)
  return (await response.json()).versions[cliVersion].dist.tarball
}

async function sha256ForTarball(url) {
  const hash = createHash('sha256').setEncoding('hex')
  const response = await http.fetch(url)
  const stream = response.body.pipe(hash)
  await new Promise((resolve) => stream.on('finish', resolve))
  return hash.read()
}

async function tarballAndShaForPackage(pkg, cliVersion) {
  const tarball = await tarballForPackage(pkg, cliVersion)
  const sha = await sha256ForTarball(tarball)
  return [tarball, sha]
}

export async function homebrewVariables(cliVersion) {
  const [[cliTarball, cliSha], [themeTarball, themeSha]] = await Promise.all([
    tarballAndShaForPackage('@shopify/cli', cliVersion),
    tarballAndShaForPackage('@shopify/theme', cliVersion),
  ])
  return {cliTarball, cliSha, themeTarball, themeSha}
}

export async function copyHomebrew(packagingDir) {
  const homebrewFormulaDest = path.normalize(
    await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'homebrew-shopify']),
  )
  const homebrewFormulas = await path.glob(path.join(packagingDir, 'homebrew/*'))
  await Promise.all(
    homebrewFormulas.map(async (sourceFile) => {
      await file.copy(sourceFile, path.join(homebrewFormulaDest, path.basename(sourceFile)))
    }),
  )
}

// import {AppInterface} from '../models/app/app.js'
import {AppInterface} from '../models/app/app.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zip} from '@shopify/cli-kit/node/archiver'
import {writeFile} from 'fs/promises'

export async function writeManifestToBundle(app: AppInterface, bundlePath: string) {
  const appManifest = await app.manifest()
  const manifestPath = joinPath(bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))
}

export async function compressBundle(inputPath: string, outputPath: string) {
  await zip({
    inputDirectory: inputPath,
    outputZipPath: outputPath,
    matchFilePattern: ['**/*', '!**/*.js.map'],
  })
}

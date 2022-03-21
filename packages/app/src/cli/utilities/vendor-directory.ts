import {path as cliKitPath, error, file} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

const __dirname = cliKitPath.dirname(fileURLToPath(import.meta.url))

/**
 * It ensures that the vendor directory exists within the package.
 * @returns {Promise<string>} A promise that resolves with the path to the vendor directory.
 */
export async function ensureExists(): Promise<string> {
  const vendorDirectory = await path()
  if (!(await file.exists(vendorDirectory))) {
    await file.mkdir(vendorDirectory)
  }
  return vendorDirectory
}

/**
 * It returns the path to the vendor directory inside the package
 * where additional files can be downloaded at runtime. For example,
 * we need to pull the binaries for developing UI extensions.
 */
export async function path(): Promise<string> {
  const appDistPath = await cliKitPath.findUp('app/package.json', {cwd: __dirname, type: 'file'})
  if (appDistPath) {
    return cliKitPath.join(cliKitPath.dirname(appDistPath), 'dist/vendor')
  } else {
    throw new error.Abort("Couldn't locate the directory @shopify/app/dist inside the node_modules directory")
  }
}

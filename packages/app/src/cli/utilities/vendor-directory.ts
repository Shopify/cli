import {path as cliKitPath, error, file} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

const __dirname = cliKitPath.dirname(fileURLToPath(import.meta.url))

/**
 * It returns the path to the vendor directory inside the package
 * where additional files can be downloaded at runtime. For example,
 * we need to pull the binaries for developing UI extensions.
 */
export async function directory(): Promise<string> {
  const appDistPath = await cliKitPath.findUp('app/package.json', {cwd: __dirname, type: 'file'})
  if (appDistPath) {
    return cliKitPath.join(cliKitPath.dirname(appDistPath), 'dist/vendor')
  } else {
    throw new error.Abort("Couldn't locate the directory @shopify/app/dist inside the node_modules directory")
  }
}

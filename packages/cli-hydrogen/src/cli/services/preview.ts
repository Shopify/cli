import {path, error, system, file} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

interface PreviewOptions {
  directory: string
  port: number
}

async function preview({directory, port}: PreviewOptions) {
  const config = {
    port,
    workerFile: 'dist/worker/index.js',
    assetsDir: 'dist/client',
    buildCommand: 'yarn build',
    modules: true,
    watch: true,
    buildWatchPaths: ['./src'],
    autoReload: true,
  }

  await file.write(path.resolve(directory, 'mini-oxygen.config.json'), JSON.stringify(config, null, 2))

  function cleanUp(options: {exit: boolean}) {
    if (options.exit) {
      file.remove(path.resolve(directory, 'mini-oxygen.config.json'))
    }
  }

  process.on('SIGINT', cleanUp.bind(null, {exit: true}))

  const executable = await oxygenPreviewExecutable()

  await system.exec(executable, [], {
    env: {NODE_OPTIONS: '--experimental-vm-modules'},
    cwd: directory,
    stdout: process.stdout,
  })
}

export default preview

export const OxygenPreviewExecutableNotFound = new error.Abort(
  'Could not locate the executable file to run Oxygen locally.',
)

async function oxygenPreviewExecutable(): Promise<string> {
  const cwd = path.dirname(fileURLToPath(import.meta.url))
  const executablePath = await path.findUp('node_modules/.bin/oxygen-preview', {type: 'file', cwd})
  if (!executablePath) {
    throw OxygenPreviewExecutableNotFound
  }
  return executablePath
}

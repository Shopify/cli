import {path, error, system, file, output} from '@shopify/cli-kit'
import {fileURLToPath} from 'url'

interface PreviewOptions {
  directory: string
  port: number
}

export async function previewInNode({directory, port}: PreviewOptions) {
  const buildOutputPath = await path.resolve(directory, 'dist/node')

  if (!(await file.exists(buildOutputPath))) {
    output.info(
      output.content`Couldn’t find a Node.js server build for this project. Running ${output.token.command(
        'yarn',
        'shopify hydrogen build',
        '--target=node',
      )} to create one.`,
    )

    await system.exec('yarn', ['shopify', 'hydrogen', 'build', '--target=node'], {
      cwd: directory,
      stdout: process.stdout,
    })
  }

  await system.exec('node', ['--enable-source-maps', buildOutputPath], {
    env: {PORT: `${port}`},
    cwd: directory,
    stdout: process.stdout,
  })
}

export async function previewInWorker({directory, port}: PreviewOptions) {
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

export const OxygenPreviewExecutableNotFound = new error.Bug(
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

import * as output from '@shopify/cli-kit/node/output'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {fileExists, removeFileSync, writeFile, findPathUp} from '@shopify/cli-kit/node/fs'
import {exec} from '@shopify/cli-kit/node/system'
import {resolvePath, dirname} from '@shopify/cli-kit/node/path'
import {BugError} from '@shopify/cli-kit/node/error'
import {fileURLToPath} from 'url'

interface PreviewOptions {
  directory: string
  port: number
}

interface PreviewOptionsWorker extends PreviewOptions {
  envPath: string | undefined
}

interface EnvConfig {
  env: DotEnvFile['variables']
}

export async function previewInNode({directory, port}: PreviewOptions) {
  const buildOutputPath = await resolvePath(directory, 'dist/node')

  if (!(await fileExists(buildOutputPath))) {
    output.info(
      output.content`Couldn’t find a Node.js server build for this project. Running ${output.token.packagejsonScript(
        'yarn',
        'shopify hydrogen build',
        '--target=node',
      )} to create one.`,
    )

    await exec('yarn', ['shopify', 'hydrogen', 'build', '--target=node'], {
      cwd: directory,
      stdout: process.stdout,
      stderr: process.stderr,
    })
  }

  await exec('node', ['--enable-source-maps', buildOutputPath], {
    env: {PORT: `${port}`},
    cwd: directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}

export async function previewInWorker({directory, port, envPath}: PreviewOptionsWorker) {
  const config = {
    port,
    workerFile: 'dist/worker/index.js',
    assetsDir: 'dist/client',
    buildCommand: 'yarn build',
    modules: true,
    watch: true,
    buildWatchPaths: ['./src'],
    autoReload: true,
    ...(envPath && (await parseEnvPath(envPath))),
  }

  await writeFile(resolvePath(directory, 'mini-oxygen.config.json'), JSON.stringify(config, null, 2))

  function cleanUp(options: {exit: boolean}) {
    if (options.exit) {
      removeFileSync(resolvePath(directory, 'mini-oxygen.config.json'))
    }
  }

  async function parseEnvPath(envPath: string): Promise<EnvConfig> {
    const {variables} = await readAndParseDotEnv(envPath)
    return {
      env: variables,
    }
  }

  process.on('SIGINT', cleanUp.bind(null, {exit: true}))

  const executable = await oxygenPreviewExecutable()

  await exec(executable, [], {
    env: {NODE_OPTIONS: '--experimental-vm-modules'},
    cwd: directory,
    stdout: process.stdout,
    stderr: process.stderr,
  })
}

export const OxygenPreviewExecutableNotFound = new BugError(
  'Could not locate the executable file to run Oxygen locally.',
)

async function oxygenPreviewExecutable(): Promise<string> {
  const cwd = dirname(fileURLToPath(import.meta.url))
  const executablePath = await findPathUp('node_modules/.bin/oxygen-preview', {
    type: 'file',
    cwd,
    allowSymlinks: true,
  })
  if (!executablePath) {
    throw OxygenPreviewExecutableNotFound
  }
  return executablePath
}

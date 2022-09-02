import {getBinaryPathOrDownload} from './binary.js'
import metadata from '../../metadata.js'
import {environment, error, path, system, output} from '@shopify/cli-kit'
import {ContentToken} from '@shopify/cli-kit/src/content-tokens.js'
import {Message} from '@shopify/cli-kit/src/output.js'
import {fileURLToPath} from 'url'
import {platform} from 'node:os'
import {Writable} from 'stream'

interface LogPayload {
  message: string
}
interface GoLog {
  status: 'inProgress' | 'success' | 'failure'
  level: 'info' | 'error'
  extensionId: string
  extensionName: string
  workflowStep: string
  payload: LogPayload
}

const NodeExtensionsCLINotFoundError = () => {
  return new error.Bug(`Couldn't find the shopify-cli-extensions Node binary`)
}

/**
 * This function runs the extensions' CLI and has support for running
 * it through its source code when the SHOPIFY_USE_EXTENSIONS_CLI_SOURCES=1 variable
 * is set.
 * @param args {string[]} Arguments to pass to the CLI
 * @param options {system.ExecOptions} Options to configure the process execution.
 */
export async function runGoExtensionsCLI(args: string[], options: system.WritableExecOptions = {}) {
  const stdout: Writable = options.stdout || new Writable({write: () => {}})
  if (environment.local.isDevelopment()) {
    await metadata.addPublic(() => ({cmd_extensions_binary_from_source: true}))
    const extensionsGoCliDirectory = (await path.findUp('packages/ui-extensions-go-cli/', {
      type: 'directory',
      cwd: path.moduleDirectory(import.meta.url),
    })) as string

    stdout.write(`Using extensions CLI from ${extensionsGoCliDirectory}`)

    // eslint-disable-next-line require-atomic-updates
    options.stdout = goLogWritable(stdout)
    try {
      if (environment.local.isDebugGoBinary()) {
        await system.exec('sh', [path.join(extensionsGoCliDirectory, 'init-debug-session')].concat(args), options)
      } else {
        const isWindows = platform() === 'win32'
        const extension = isWindows ? '.exe' : ''
        await system.exec(path.join(extensionsGoCliDirectory, `shopify-extensions${extension}`), args, options)
      }
    } catch {
      throw new error.AbortSilent()
    }
  } else {
    await metadata.addPublic(() => ({cmd_extensions_binary_from_source: false}))
    const binaryPath = await getBinaryPathOrDownload()
    await system.exec(binaryPath, [...args], options)
  }
}

/**
 * The extensions' CLI is comprised by a Go and Node executable. The latter is distributed
 * as an NPM package, @shopify/shopify-cli-extensions, which is dependency of @shopify/app.
 * This method looks up the binary under node_modules/.bin and returns its path.
 * @returns {Promise<string>} A promise that resolves with the path to the Node executable.
 */
export async function nodeExtensionsCLIPath(): Promise<string> {
  const cwd = path.dirname(fileURLToPath(import.meta.url))
  if (environment.local.isDevelopment()) {
    return (await path.findUp('packages/ui-extensions-cli/bin/cli.js', {
      type: 'file',
      cwd,
    })) as string
  } else {
    const executablePath = await path.findUp('node_modules/@shopify/shopify-cli-extensions/dist/cli.js', {
      type: 'file',
      cwd,
      allowSymlinks: true,
    })
    if (!executablePath) {
      throw NodeExtensionsCLINotFoundError()
    }
    return executablePath
  }
}

/**
 * This method provides a Writable wraper which parses the incoming chunks as GoLog from Json and writes them back to
 * the Writable given as parameter. If Parsing to Json fails it writes the chunk as it is.
 * @param output {Writable} A Writable which will be wrapped and in which the parsed chunks will be written.
 * @returns {Writable} A Writable wrapping the parameter.
 */
export function goLogWritable(outputWritable: Writable): Writable {
  return new Writable({
    write(chunk, _encoding, next) {
      const rawLogs = output.stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split(/###LOG_END###/)
      for (const rawLog of rawLogs) {
        if (rawLog) {
          try {
            const log = JSON.parse(rawLog) as GoLog
            outputWritable.write(parseGoLogMessage(log))
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (err) {
            outputWritable.write(rawLog)
          }
        }
      }
      next()
    },
  })
}

function parseGoLogMessage(log: GoLog): string {
  if (!log.level || !log.status || !log.payload.message) {
    throw new Error(`Invalid log: ${log}`)
  }

  if (log.extensionName) {
    return output.content`${log.extensionName} ${styleWorkflowStep(log.workflowStep)}: ${styleContent(
      log.payload.message,
      log.status,
    )}`.value
  }
  return output.content`${styleWorkflowStep(log.workflowStep)}: ${styleContent(log.payload.message, log.status)}`.value
}

function styleContent(content: string, status: 'success' | 'failure' | 'inProgress'): ContentToken<Message> {
  switch (status) {
    case 'success':
      return output.token.green(content)
    case 'failure':
      return output.token.errorText(content)
    default:
      return output.token.raw(content)
  }
}

function styleWorkflowStep(steps: string): ContentToken<Message> {
  return output.token.magenta(`[${steps}]`)
}

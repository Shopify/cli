import {isUnitTest} from './environment/local.js'
import constants from './constants.js'
import {generateRandomUUID} from './id.js'
import {
  mkdirSync as fileMkdirSync,
  size as fileSize,
  touchSync as fileTouchSync,
  readSync as fileReadSync,
} from './file.js'
import {join as pathJoin} from './path.js'
import {consoleLog} from './output.js'
import {page} from './system.js'
import * as ui from './ui.js'
import {promisify} from 'node:util'
import {Stream, Transform, TransformCallback, TransformOptions} from 'node:stream'
import {WriteStream, createWriteStream, createReadStream, unlinkSync} from 'node:fs'
import {EOL} from 'node:os'

const logFileName = 'shopify.cli.log'
const maxLogFileSize = 5 * 1024 * 1024
const maxLogFileSizeToTruncate = 30 * 1024 * 1024
let logFileStream: WriteStream
let commandUuid: string
let logFilePath: string

interface LinesTruncatorTransformerOptions {
  fileSize: number
  maxFileSize?: number
  maxFileSizeToTruncate?: number
}
export class LinesTruncatorTransformer extends Transform {
  linesToRetain: string[] = []
  lastLineCompleted = true
  contentSize = 0
  options: LinesTruncatorTransformerOptions

  constructor(truncatorOptions: LinesTruncatorTransformerOptions, opts?: TransformOptions) {
    super(opts)
    this.options = truncatorOptions
  }

  _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.shouldTruncate(chunk)) {
      this.truncate(chunk)
    }
    callback()
  }

  _flush(callback: TransformCallback): void {
    this.push(this.linesToRetain.join(EOL))
    callback()
  }

  shouldTruncate(chunk: unknown): boolean {
    this.contentSize += (chunk as string).toString().length
    return this.options.fileSize - this.contentSize < (this.options.maxFileSizeToTruncate ?? maxLogFileSizeToTruncate)
  }

  truncate(chunk: unknown) {
    const tokens = (chunk as string).toString().split(EOL)

    this.completeLastLine(tokens)
    // last splitted token will be an empty string when last character is a breakline
    this.lastLineCompleted = tokens[tokens.length - 1] === ''
    if (this.lastLineCompleted) {
      tokens.pop()
    }
    this.linesToRetain = this.linesToRetain.concat(tokens)

    const numLinesToRetain = this.calculateNumLinesToRetain()
    if (this.linesToRetain.length > numLinesToRetain) {
      this.linesToRetain = this.linesToRetain.splice(this.linesToRetain.length - numLinesToRetain)
    }
  }

  // Lines retained length average is used so the number of lines depends on the length of them
  calculateNumLinesToRetain() {
    return Math.floor(
      (this.options.maxFileSize ?? maxLogFileSize) /
        (this.linesToRetain.map((line) => line.length).reduce((l1, l2) => l1 + l2, 0) / this.linesToRetain.length),
    )
  }

  completeLastLine(tokens: string[]) {
    if (this.lastLineCompleted) {
      return
    }

    const remainingToken = tokens.shift() ?? ''
    const incompleteToken = this.linesToRetain[this.linesToRetain.length - 1] ?? ''
    this.linesToRetain[this.linesToRetain.length - 1] = incompleteToken.concat(remainingToken)
  }
}

export async function initiateLogging(options: {logDir?: string; override?: boolean} = {}) {
  if (isUnitTest()) return
  commandUuid = generateRandomUUID()
  logFilePath = getLogFilePath(options)
  await truncateLogs(logFilePath)
  logFileStream = createWriteStream(logFilePath, {flags: 'a'})
}

export function closeLogging() {
  if (logFileExists()) {
    logFileStream.end()
  }
}

// DO NOT USE THIS FUNCTION DIRECTLY under normal circumstances.
// It is exported purely for use in cases where output is already being logged
// to the terminal but is not reflected in the logfile, e.g. Listr output.
export function logToFile(message: string, logLevel: string): void {
  // If file logging hasn't been initiated, skip it
  if (!logFileExists()) return
  const timestamp = new Date().toISOString()
  const logContents = `[${timestamp} ${commandUuid} ${logLevel}]: ${message}\n`
  logFileStream.write(logContents)
}

export async function pageLogs({lastCommand}: {lastCommand: boolean}) {
  const logDir = constants.paths.directories.cache.path()
  const logFile = pathJoin(logDir, logFileName)
  // Ensure file exists in case they deleted it or something
  fileTouchSync(logFile)
  if (lastCommand) {
    printLastCommand(logFile)
  } else {
    await page(logFile)
  }
}

function getLogFilePath(options: {logDir?: string; override?: boolean} = {}) {
  if (!logFilePath || options.override) {
    const logDir = options.logDir || constants.paths.directories.cache.path()
    fileMkdirSync(logDir)
    logFilePath = pathJoin(logDir, logFileName)
    fileTouchSync(logFilePath)
  }

  return logFilePath
}

// Shaves off older log lines if logs are over maxLogFileSize long.
async function truncateLogs(logFile: string) {
  const size = await fileSize(logFile)
  if (size < maxLogFileSize) {
    return
  }
  const list = ui.newListr([
    {
      title: 'Truncation of the log file',
      task: async (_, task) => {
        task.title = `Starting the truncation of the ${Math.floor(size / (1024 * 1024)).toLocaleString(
          'en-US',
        )}MB log file`
        const tmpLogFile = logFile.concat('.tmp')
        const truncateLines = new LinesTruncatorTransformer({fileSize: size})
        const pipeline = promisify(Stream.pipeline)
        await pipeline(createReadStream(logFile), truncateLines, createWriteStream(tmpLogFile))
        await pipeline(createReadStream(tmpLogFile), createWriteStream(logFile))
        unlinkSync(tmpLogFile)
        task.title = 'Finished log truncation process'
      },
    },
  ])
  await list.run()
}

function logFileExists(): boolean {
  return Boolean(logFileStream)
}

function printLastCommand(logFile: string): void {
  const contents = fileReadSync(logFile).split('\n')
  const uuids = contents
    .map(logfileLineUUID)
    .filter((uuid) => uuid)
    .reverse()
  // 2nd unique UUID, because the currently running command will be the 1st
  const relevantUuid = Array.from(new Set(uuids))[1]
  if (relevantUuid) {
    consoleLog(relevantLines(contents, relevantUuid).join('\n'))
  }
}

function relevantLines(contents: string[], relevantUuid: string): string[] {
  // We run through the file line by line, keeping track of the most recently
  // encountered UUID.
  //
  // If the current line has a UUID, it's a new logged unit and should be
  // considered. Otherwise, the line is related to the most recent UUID.
  let mostRecentUuid = ''
  return contents.filter((line: string) => {
    const currentUuid = logfileLineUUID(line) || mostRecentUuid
    mostRecentUuid = currentUuid
    return currentUuid === relevantUuid
  })
}

function logfileLineUUID(line: string): string | null {
  // Log lines look like:
  //
  //         timestamp                        UUID                               contents
  // ===========================================================================================
  // [2022-07-20T08:51:40.296Z 5288e1da-a06a-4f96-b1a6-e34fcdd7b416 DEBUG]: Running command logs
  // ===========================================================================================
  //
  // There may be subsequent lines if the contents section is multi-line.
  //
  const match = line.match(/^\[\S+ ([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}) [A-Z]+\]/)
  return match && match[1]!
}

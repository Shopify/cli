import {isUnitTest} from './environment/local.js'
import constants from './constants.js'
import {generateRandomUUID} from './id.js'
import {
  mkdirSync as fileMkdirSync,
  sizeSync as fileSizeSync,
  touchSync as fileTouchSync,
  readSync as fileReadSync,
} from './file.js'
import {join as pathJoin} from './path.js'
import {consoleLog} from './output.js'
import {page} from './system.js'
import {promisify} from 'node:util'
import {Stream, Transform, TransformCallback, TransformOptions} from 'node:stream'
import {WriteStream, createWriteStream, createReadStream, unlinkSync} from 'node:fs'
import {EOL} from 'node:os'

const logFileName = 'shopify.cli.log'
const maxLogFileSize = 5 * 1024 * 1024
let logFileStream: WriteStream
let commandUuid: string
let logFilePath: string
let truncating = false

export class LinesTruncatorTransformer extends Transform {
  linesToRetain: string[] = []
  lastLineCompleted = true

  constructor(readonly maxFileSize: number, opts?: TransformOptions) {
    super(opts)
  }

  _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback): void {
    const tokens = (chunk as string).toString().split(EOL)

    this.completeLastLine(tokens)
    // if last character is a breakline last splitted token will be an empty string
    this.lastLineCompleted = tokens[tokens.length - 1] === ''
    if (this.lastLineCompleted) {
      tokens.pop()
    }
    this.linesToRetain = this.linesToRetain.concat(tokens)

    const numLinesToRetain = this.calculateNumLinesToRetain()
    if (this.linesToRetain.length > numLinesToRetain) {
      this.linesToRetain = this.linesToRetain.splice(this.linesToRetain.length - numLinesToRetain)
    }
    callback()
  }

  _flush(callback: TransformCallback): void {
    this.push(this.linesToRetain.join(EOL))
    callback()
  }

  // Lines retained length average is used so the number of lines depends on the length of them
  calculateNumLinesToRetain() {
    return Math.floor(
      this.maxFileSize /
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
  if (truncating || fileSizeSync(logFile) < maxLogFileSize) {
    return
  }
  const tmpLogFile = logFile.concat('.tmp')
  truncating = true
  const truncateLines = new LinesTruncatorTransformer(maxLogFileSize)
  const pipeline = promisify(Stream.pipeline)
  await pipeline(createReadStream(logFile), truncateLines, createWriteStream(tmpLogFile))
  await pipeline(createReadStream(tmpLogFile), createWriteStream(logFile)).then(() => {
    unlinkSync(tmpLogFile)
    truncating = false
  })
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

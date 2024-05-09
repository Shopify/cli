import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {readdirSync} from 'fs'

export async function readFunctionRunsDirectory(functionPath: string) {
  // Determine folder to read for runs
  // We'll need to update this to use the actual path when they are saved.
  const runsFolder = joinPath(functionPath, 'runs')

  // Read file names
  // This might actually be a JSONL file
  const runFileNames = readdirSync(runsFolder)

  // full paths to read file
  const runFilePaths = runFileNames.map((runFile) => joinPath(runsFolder, runFile))

  // read contents
  const runData = await Promise.all(
    runFilePaths.map((runFile) => {
      return readFile(runFile)
    }),
  )

  // convert promise'd strings to json
  const runs = runData.map((run) => JSON.parse(run))
  return runs
}

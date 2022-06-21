import {debug, content, token} from '../output'
import {zip as crossZip} from 'cross-zip'

export async function zip(inputDirectory: string, outputZipPath: string): Promise<void> {
  debug(content`Zipping ${token.path(inputDirectory)} into ${token.path(outputZipPath)}`)
  const cwd = process.cwd()
  process.chdir(inputDirectory)

  await new Promise<void>((resolve, reject) => {
    crossZip('./', outputZipPath, (error) => {
      process.chdir(cwd)
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export async function unzip(inputDirectory: string, outputZipPath: string): Promise<void> {}

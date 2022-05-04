import {zip as crossZip} from 'cross-zip'

export async function zip(inputDirectory: string, outputZipPath: string): Promise<void> {
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

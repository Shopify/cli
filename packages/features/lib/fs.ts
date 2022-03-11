import fs from 'fs'

export async function mkdir(path: string): Promise<void> {
  await fs.promises.mkdir(path, {recursive: true})
}

export async function writeFile(path: string, data: string): Promise<void> {
  await fs.promises.writeFile(path, data)
}

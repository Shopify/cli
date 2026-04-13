import {AppConfigurationFileName, isValidFormatAppConfigurationFileName} from '../../../models/app/loader.js'
import {isDirectory, readdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'

export async function getTomls(appDirectory?: string): Promise<{[clientId: string]: AppConfigurationFileName}> {
  if (!appDirectory || !(await isDirectory(appDirectory))) {
    return {}
  }

  const clientIds: {[key: string]: AppConfigurationFileName} = {}

  const files = await readdir(appDirectory)
  await Promise.all(
    files.map(async (file) => {
      if (isValidFormatAppConfigurationFileName(file)) {
        const filePath = joinPath(appDirectory, file)
        const tomlFile = await TomlFile.read(filePath)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedToml = tomlFile.content as {[key: string]: any}

        if (parsedToml.client_id) {
          clientIds[parsedToml.client_id] = file
        }
      }
    }),
  )

  return clientIds
}

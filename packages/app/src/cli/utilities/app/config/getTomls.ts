import {loadConfigurationFileContent} from '../../../models/app/loader.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readdirSync} from 'fs'

export async function getTomls(appDirectory?: string) {
  if (!appDirectory) {
    return {}
  }

  const regex = /^shopify\.app(\.[-\w]+)?\.toml$/
  const clientIds: {[key: string]: string} = {}

  const files = readdirSync(appDirectory)
  await Promise.all(
    files.map(async (file) => {
      if (regex.test(file)) {
        const filePath = joinPath(appDirectory, file)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedToml = (await loadConfigurationFileContent(filePath)) as {[key: string]: any}

        if (parsedToml.client_id) {
          clientIds[parsedToml.client_id] = file
        }
      }
    }),
  )

  return clientIds
}

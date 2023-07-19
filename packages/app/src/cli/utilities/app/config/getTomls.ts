import {OrganizationAppsResponse} from '../../../services/dev/fetch.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {readFileSync, readdirSync} from 'fs'

export async function getTomls(apps: OrganizationAppsResponse, appDirectory?: string) {
  if (!appDirectory) {
    return {}
  }

  const regex = /^shopify\.app(\.[-\w]+)?\.toml$/
  const clientIds: {[key: string]: string} = {}

  readdirSync(appDirectory).forEach((file) => {
    if (regex.test(file)) {
      const filePath = joinPath(appDirectory, file)
      const fileContent = readFileSync(filePath, 'utf8')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedToml: {[key: string]: any} = decodeToml(fileContent)

      if (parsedToml.client_id) {
        clientIds[parsedToml.client_id] = file
      }
    }
  })

  return clientIds
}

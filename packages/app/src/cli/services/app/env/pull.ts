import {getAppEnv} from './show.js'
import {type AppEnvPullResult} from './pull/types.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {Organization, OrganizationApp} from '../../../models/organization.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {resolvePath} from '@shopify/cli-kit/node/path'

interface PullEnvOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  envFile: string
}

export interface PullEnvOutput {
  result: AppEnvPullResult
  previousContent: string | null
}

export async function pullEnv({app, remoteApp, organization, envFile}: PullEnvOptions): Promise<PullEnvOutput> {
  const {variables} = await getAppEnv(app, remoteApp, organization)
  const path = resolvePath(envFile)
  const previousContent = (await fileExists(path)) ? await readFile(path) : null
  const content = patchEnvFile(previousContent, Object.fromEntries(variables.map(({name, value}) => [name, value])))
  const changed = content !== previousContent
  if (changed) await writeFile(path, content)
  return {result: {path, status: 'success', changed, variables, content}, previousContent}
}

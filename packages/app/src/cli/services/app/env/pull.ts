import {getAppEnv} from './show.js'
import {type AppEnvPullResult} from './pull/types.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {Organization, OrganizationApp} from '../../../models/organization.js'
import {patchEnvFile} from '@shopify/cli-kit/node/dot-env'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'

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
  const variables = await getAppEnv(app, remoteApp, organization)
  const previousContent = (await fileExists(envFile)) ? await readFile(envFile) : null
  const content = patchEnvFile(previousContent, variables)
  let status: AppEnvPullResult['status'] = 'unchanged'
  if (previousContent === null) status = 'created'
  else if (content !== previousContent) status = 'updated'
  if (status !== 'unchanged') await writeFile(envFile, content)
  return {result: {path: envFile, status, variables, content}, previousContent}
}

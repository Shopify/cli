import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {fetchAppAndIdentifiers} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {fileExists, inTemporaryDirectory, mkdir, moveFile, removeFile, glob, findPathUp} from '@shopify/cli-kit/node/fs'

import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** The deployment label */
  label?: string
}

export async function writeExistingFlowDashboardExtensions(options: DeployOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp] = await fetchAppAndIdentifiers(options, token)
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey: partnersApp.apiKey})

  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  dashboardManagedExtensionRegistrations.forEach((extension) => {
    if (extension && extension.activeVersion && extension.activeVersion.config) {
      writeExtensionToml(extension)
    }
  })
}

async function getTemplatePath(name: string): Promise<string> {
  const templatePath = await findPathUp(`templates/${name}`, {
    cwd: dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  })
  if (templatePath) {
    return templatePath
  } else {
    throw new BugError(`Couldn't find the template ${name} in @shopify/app.`)
  }
}

const writeExtensionToml = (extension: any) => {
  const templatePath =
});

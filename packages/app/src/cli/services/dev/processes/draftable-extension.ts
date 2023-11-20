import {BaseProcess, DevProcessFunction} from './types.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface, getAppScopes} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching, ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {installJavy} from '../../function/build.js'
import {DevSessionCreateMutation} from '../../../api/graphql/dev_session_create.js'

import {DevSessionUpdateMutation} from '../../../api/graphql/dev_session_update.js'
import {bundleForDev} from '../../deploy/bundle.js'
import {
  DevSessionGenerateUrlMutation,
  DevSessionGenerateUrlSchema,
} from '../../../api/graphql/dev_session_generate_url.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {emptyDir, fileExistsSync, mkdir, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

export interface DraftableExtensionOptions {
  extensions: ExtensionInstance[]
  token: string
  apiKey: string
  remoteExtensionIds: {[key: string]: string}
  proxyUrl: string
  localApp: AppInterface
  adminSession: AdminSession
}

export interface DraftableExtensionProcess extends BaseProcess<DraftableExtensionOptions> {
  type: 'draftable-extension'
}

async function prepareDevFolder(directory: string) {
  const path = joinPath(directory, '.shopify-dev')
  if (fileExistsSync(path)) {
    await emptyDir(path)
  } else {
    await mkdir(path)
  }
  return path
}

export const pushUpdatesForDraftableExtensions: DevProcessFunction<DraftableExtensionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  {extensions, token, adminSession, apiKey, remoteExtensionIds: remoteExtensions, proxyUrl, localApp: app},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  // Start dev session
  await adminRequest(DevSessionCreateMutation, adminSession, {
    title: 'dev-app',
    scopes: getAppScopes(app.configuration),
    applicationUrl: proxyUrl,
  })

  // Folder where we are going to store all shopify built extensions
  const devFolder = await prepareDevFolder(app.directory)

  // Initial update of all modules
  await updateAppModules({app, extensions, adminSession, token, apiKey, stdout, devFolder})

  await Promise.all(
    extensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal, environment: 'development'})
      const registrationId = remoteExtensions[extension.localIdentifier]
      if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
      // Initial draft update for each extension
      // await updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr})
      // Watch for changes
      return setupExtensionWatcher({
        extension,
        app,
        url: proxyUrl,
        stdout,
        stderr,
        signal,
        token,
        apiKey,
        registrationId,
      })
    }),
  )
}

export async function setupDraftableExtensionsProcess({
  localApp,
  apiKey,
  token,
  remoteApp,
  ...options
}: Omit<DraftableExtensionOptions, 'remoteExtensionIds' | 'extensions'> & {
  remoteApp: PartnersAppForIdentifierMatching
}): Promise<DraftableExtensionProcess | undefined> {
  // it would be good if this process didn't require the full local & remote app instances
  const draftableExtensions = localApp.allExtensions.filter((ext) => ext.isDraftable())
  if (draftableExtensions.length === 0) {
    return
  }
  const prodEnvIdentifiers = getAppIdentifiers({app: localApp})

  const {extensionIds: remoteExtensionIds, extensions: extensionsUuids} = await ensureDeploymentIdsPresence({
    app: localApp,
    partnersApp: remoteApp,
    appId: apiKey,
    appName: remoteApp.title,
    force: true,
    release: true,
    token,
    envIdentifiers: prodEnvIdentifiers,
  })

  // Update the local app with the remote extension UUIDs.
  // Extensions are initialized with a random dev UUID when running the dev command
  // which is sent over WS messages for live reload in dev preview of UI Extensions.
  localApp.updateExtensionUUIDS(extensionsUuids)

  return {
    type: 'draftable-extension',
    prefix: 'extensions',
    function: pushUpdatesForDraftableExtensions,
    options: {
      localApp,
      apiKey,
      token,
      ...options,
      extensions: draftableExtensions,
      remoteExtensionIds,
    },
  }
}

export interface UpdateAppModulesOptions {
  app: AppInterface
  devFolder: string
  extensions: ExtensionInstance[]
  adminSession: AdminSession
  token: string
  apiKey: string
  stdout: Writable
}

export async function updateAppModules({
  app,
  devFolder,
  extensions,
  adminSession,
  token,
  stdout,
  apiKey,
}: UpdateAppModulesOptions) {
  // Consider creating an empty `.shopify-dev` folder to reuse results
  // await inTemporaryDirectory(async (tmpDir) => {
  try {
    const bundlePath = joinPath(devFolder, `bundle.zip`)
    await mkdir(dirname(bundlePath))
    await bundleForDev({app, extensions, bundlePath, directory: devFolder, stdout})

    const signedUrlResult: DevSessionGenerateUrlSchema = await adminRequest(
      DevSessionGenerateUrlMutation,
      adminSession,
      {apiKey},
    )

    const signedUrl = signedUrlResult.generateDevSessionSignedUrl.signedUrl

    const form = formData()
    const buffer = readFileSync(bundlePath)
    form.append('my_upload', buffer)
    await fetch(signedUrl, {
      method: 'put',
      body: buffer,
      headers: form.getHeaders(),
    })

    const appModules = await Promise.all(
      extensions.flatMap((ext) => ext.bundleConfig({identifiers: {}, token, apiKey: 'dev-apiKey'})),
    )

    await adminRequest(DevSessionUpdateMutation, adminSession, {
      appModules,
      bundleUrl: signedUrl,
      apiKey,
    })

    const names = extensions.map((ext) => ext.localIdentifier).join(', ')

    outputInfo(`Updated app modules: ${names}`, stdout)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputInfo(`Failed to update app modules: ${error}`, stdout)
  }
  // })
}

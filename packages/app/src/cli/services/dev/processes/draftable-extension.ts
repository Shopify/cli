import {BaseProcess, DevProcessFunction} from './types.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching} from '../../context/identifiers.js'
import {installJavy} from '../../function/build.js'
import {DevSessionCreateMutation, DevSessionCreateSchema} from '../../../api/graphql/dev_session_create.js'

import {
  DevSessionUpdateMutation,
  DevSessionUpdateSchema,
  DevSessionUpdateVariables,
} from '../../../api/graphql/dev_session_update.js'
import {bundleForDev} from '../../deploy/bundle.js'
import {
  DevSessionGenerateUrlMutation,
  DevSessionGenerateUrlSchema,
} from '../../../api/graphql/dev_session_generate_url.js'
import {DevSessionDeleteMutation} from '../../../api/graphql/dev_session_delete.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {emptyDir, fileExistsSync, mkdir, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Writable} from 'stream'

export interface DraftableExtensionOptions {
  extensions: ExtensionInstance[]
  token: string
  apiKey: string
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
  {extensions, token, adminSession, apiKey, proxyUrl, localApp: app},
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  await installJavy(app)

  // Start dev session
  const result: DevSessionCreateSchema = await adminRequest(DevSessionCreateMutation, adminSession, {
    apiKey,
  })

  if (result.devSessionCreate.userErrors?.length > 0) {
    const errors = result.devSessionCreate.userErrors.map((error) => error.message).join(', ')
    outputInfo(`Error while creating dev session: ${errors}`, stdout)
    // throw new Error(`Error while creating dev session: ${errors}`)
  }

  signal.addEventListener('abort', async () => {
    outputInfo(`Stopping dev session`, stdout)
    await adminRequest(DevSessionDeleteMutation, adminSession, {apiKey})
    outputInfo(`Stopped`, stdout)
  })

  // Folder where we are going to store all shopify built extensions
  const devFolder = await prepareDevFolder(app.directory)

  // Initial update of all modules
  await updateAppModules({app, extensions, adminSession, token, apiKey, stdout, devFolder})

  await Promise.all(
    extensions.map(async (extension) => {
      await extension.build({app, stdout, stderr, useTasks: false, signal, environment: 'development'})
      // const registrationId = remoteExtensions[extension.localIdentifier]
      // if (!registrationId) throw new AbortError(`Extension ${extension.localIdentifier} not found on remote app.`)
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
        adminSession,
        apiKey,
        devFolder,
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
      // remoteExtensionIds,
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
    outputInfo(`Updating app modules`, stdout)
    const bundlePath = joinPath(devFolder, `bundle.zip`)
    await mkdir(dirname(bundlePath))
    await bundleForDev({app, extensions, bundlePath, directory: devFolder, stdout})

    const signedUrlResult: DevSessionGenerateUrlSchema = await adminRequest(
      DevSessionGenerateUrlMutation,
      adminSession,
      {apiKey},
    )

    if (signedUrlResult.devSessionSignedUrlGenerate.userErrors?.length > 0) {
      const errors = signedUrlResult.devSessionSignedUrlGenerate.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Error while generating signed url: ${errors}`)
    }

    const signedUrl = signedUrlResult.devSessionSignedUrlGenerate.signedUrl

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
    const appM = getArrayRejectingUndefined(appModules)

    const variables: DevSessionUpdateVariables = {
      appModules: appM,
      bundleUrl: signedUrl,
      apiKey,
    }
    const result: DevSessionUpdateSchema = await adminRequest(DevSessionUpdateMutation, adminSession, variables)

    if (result.devSessionUpdate.userErrors?.length > 0) {
      const errors = result.devSessionUpdate.userErrors.map((error) => error.message).join(', ')
      throw new Error(`Error while updating app modules: ${errors}`)
    }

    const names = extensions.map((ext) => ext.localIdentifier).join(', ')

    outputInfo(`Updated app modules: ${names}`, stdout)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputInfo(`Failed to update app modules: ${error}`, stdout)
  }
  // })
}

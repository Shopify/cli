import {BaseProcess, DevProcessFunction} from './types.js'
import {AppInterface} from '../../../models/app/app.js'
import {PartnersAppForIdentifierMatching} from '../../context/identifiers.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {installJavy} from '../../function/build.js'
import {DevSessionCreateMutation, DevSessionCreateSchema} from '../../../api/graphql/dev_session_create.js'
import {DevSessionDeleteMutation} from '../../../api/graphql/dev_session_delete.js'
import {bundleForDev} from '../../deploy/bundle.js'
import {
  DevSessionGenerateUrlMutation,
  DevSessionGenerateUrlSchema,
} from '../../../api/graphql/dev_session_generate_url.js'
import {
  DevSessionUpdateMutation,
  DevSessionUpdateSchema,
  DevSessionUpdateVariables,
} from '../../../api/graphql/dev_session_update.js'
import {setupExtensionWatcher} from '../extension/bundler.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {emptyDir, fileExistsSync, mkdir, readFileSync} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Writable} from 'stream'

export interface ConsistentDevOptions {
  token: string
  apiKey: string
  proxyUrl: string
  localApp: AppInterface
  adminSession: AdminSession
  extensions: ExtensionInstance[]
}

export interface UpdateAppModulesOptions {
  app: AppInterface
  devFolder: string
  extensions: ExtensionInstance[]
  adminSession: AdminSession
  token: string
  apiKey: string
  isNewSession: boolean
  stdout: Writable
}

export interface ConsistentDevProcess extends BaseProcess<ConsistentDevOptions> {
  type: 'consistent-dev'
}

export async function setupConsistentDevProcess({
  localApp,
  apiKey,
  token,
  remoteApp,
  ...options
}: Omit<ConsistentDevOptions, 'extensions'> & {
  remoteApp: PartnersAppForIdentifierMatching
}): Promise<ConsistentDevProcess | undefined> {
  return {
    type: 'consistent-dev',
    prefix: 'extensions',
    function: startConsistentDevSession,
    options: {
      localApp,
      apiKey,
      token,
      ...options,
      extensions: localApp.allExtensions,
      // remoteExtensionIds,
    },
  }
}

export const startConsistentDevSession: DevProcessFunction<ConsistentDevOptions> = async (
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
  await updateAppModules({app, extensions, adminSession, token, apiKey, stdout, devFolder, isNewSession: true})

  await Promise.all(
    extensions.map(async (extension) => {
      return setupExtensionWatcher({
        extension,
        app,
        url: proxyUrl,
        stdout,
        stderr,
        signal,
        onChange: async () => {
          // At this point the extension has alreday been built and is ready to be updated
          await updateAppModules({
            app,
            extensions: [extension],
            adminSession,
            token,
            apiKey,
            stdout,
            devFolder,
            isNewSession: false,
          })
        },
      })
    }),
  )
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

export async function updateAppModules({
  app,
  devFolder,
  extensions,
  adminSession,
  token,
  isNewSession,
  stdout,
  apiKey,
}: UpdateAppModulesOptions) {
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
      extensions.flatMap(async (ext) => {
        const bundleConfig = await ext.bundleConfig({identifiers: {}, token, apiKey})
        if (!bundleConfig) return undefined
        return {
          ...bundleConfig,
          specificationIdentifier: ext.specification.identifier,
        }
      }),
    )

    const appM = getArrayRejectingUndefined(appModules)

    const variables: DevSessionUpdateVariables = {
      appModules: appM,
      bundleUrl: signedUrl,
      apiKey,
      devSessionUpdateType: isNewSession ? 'ABSOLUTE' : 'UPDATE_ONLY',
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
}

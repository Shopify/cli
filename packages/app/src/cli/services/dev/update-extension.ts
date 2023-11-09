import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {loadConfigurationFile, parseConfigurationFile, parseConfigurationObject} from '../../models/app/loader.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../../models/extensions/schemas.js'
import {AppInterface} from '../../models/app/app.js'
import {bundleAndBuildExtensionsInConcurrent} from '../deploy/bundle.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, mkdir, readFile, readFileSync} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {OutputMessage, outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {dirname, joinPath, relativizePath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
}

export async function updateExtensionDraft({
  extension,
  token,
  apiKey,
  registrationId,
  stdout,
  stderr,
}: UpdateExtensionDraftOptions) {
  let encodedFile: string | undefined
  if (extension.features.includes('esbuild')) {
    const content = await readFile(extension.outputPath)
    if (!content) return
    encodedFile = Buffer.from(content).toString('base64')
  }

  const configValue = (await extension.deployConfig({apiKey, token})) || {}
  const {handle, ...remainingConfigs} = configValue
  const extensionInput: ExtensionUpdateDraftInput = {
    apiKey,
    config: JSON.stringify({
      ...remainingConfigs,
      serialized_script: encodedFile,
    }),
    handle: extension.handle,
    context: handle as string,
    registrationId,
  }
  const mutation = ExtensionUpdateDraftMutation

  const mutationResult: ExtensionUpdateSchema = await partnersRequest(mutation, token, extensionInput)
  if (mutationResult.extensionUpdateDraft?.userErrors?.length > 0) {
    const errors = mutationResult.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    stderr.write(`Error while updating drafts: ${errors}`)
  } else {
    outputInfo(`Draft updated successfully for extension: ${extension.localIdentifier}`, stdout)
  }
}

interface UpdateExtensionConfigOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
}

export async function updateExtensionConfig({
  extension,
  token,
  apiKey,
  registrationId,
  stdout,
  stderr,
}: UpdateExtensionConfigOptions) {
  const abort = (errorMessage: OutputMessage) => {
    stdout.write(errorMessage)
    throw new AbortError(errorMessage)
  }

  let configObject = await loadConfigurationFile(extension.configuration.path)
  const {extensions} = ExtensionsArraySchema.parse(configObject)

  if (extensions) {
    // If the config has an array, find our extension using the handle.
    const configuration = await parseConfigurationFile(UnifiedSchema, extension.configuration.path, abort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionConfig = configuration.extensions.find((config: any) => config.handle === extension.handle)
    if (!extensionConfig) {
      abort(
        `ERROR: Invalid handle
  - Expected handle: "${extension.handle}"
  - Configuration file path: ${relativizePath(extension.configuration.path)}.
  - Handles are immutable, you can't change them once they are set.`,
      )
    }

    configObject = {...configuration, ...extensionConfig}
  }

  const newConfig = await parseConfigurationObject(
    extension.specification.schema,
    extension.configuration.path,
    configObject,
    abort,
  )

  // eslint-disable-next-line require-atomic-updates
  extension.configuration = newConfig
  return updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr})
}

export interface UpdateAppModulesOptions {
  app: AppInterface
  extensions: ExtensionInstance[]
  adminSession: AdminSession
  token: string
  apiKey: string
  stdout?: Writable
}

export async function updateAppModules({
  app,
  extensions,
  adminSession,
  token,
  apiKey,
  stdout,
}: UpdateAppModulesOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    try {
      // const signedUrlResult: DevSessionGenerateUrlSchema = await adminRequest(
      //   DevSessionGenerateUrlMutation,
      //   adminSession,
      //   {
      //     apiKey,
      //   },
      // )
      const signedUrl = ''

      const bundlePath = joinPath(tmpDir, `bundle.zip`)
      await mkdir(dirname(bundlePath))
      const identifiers = {app: apiKey, extensionIds: {}, extensions: {}}
      await bundleAndBuildExtensionsInConcurrent({
        app,
        identifiers,
        extensions,
        bundlePath,
        stdout:
          stdout ??
          new Writable({
            write(chunk, ...args) {
              // Do nothing if there is stdout
            },
          }),
      })

      const form = formData()
      const buffer = readFileSync(bundlePath)
      form.append('my_upload', buffer)
      await fetch(signedUrl, {
        method: 'put',
        body: buffer,
        headers: form.getHeaders(),
      })

      const appModules = await Promise.all(extensions.flatMap((ext) => ext.bundleConfig({identifiers, token, apiKey})))

      // await adminRequest(DevSessionUpdateMutation, adminSession, {
      //   apiKey,
      //   appModules,
      //   bundleUrl: signedUrlResult.generateDevSessionSignedUrl.signedUrl,
      // })

      const names = extensions.map((ext) => ext.localIdentifier).join(', ')

      if (stdout) {
        outputInfo(`Updated app modules: ${names}`, stdout)
      } else {
        outputSuccess(`Ephemeral dev session is ready`)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputInfo(`Failed to update app modules: ${error}`, stdout)
    }
  })
}

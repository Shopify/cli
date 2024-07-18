import {BaseProcess, DevProcessFunction} from './types.js'
import {installJavy} from '../../function/build.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppInterface} from '../../../models/app/app.js'
import {getExtensionUploadURL} from '../../deploy/upload.js'
import {AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {mkdir, readFileSync, tempDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {zip} from '@shopify/cli-kit/node/archiver'
import {formData} from '@shopify/cli-kit/node/http'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs} from '@shopify/cli-kit/node/hrtime'
import {Writable} from 'stream'

export interface DevSessionOptions {
  extensions: ExtensionInstance[]
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiKey: string
  url: string
  app: AppInterface
  organizationId: string
  appId: string
}

export interface DevSessionProcessOptions extends DevSessionOptions {
  bundlePath: string
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

export interface DevSessionProcess extends BaseProcess<DevSessionOptions> {
  type: 'dev-session'
}

export async function setupDevSessionProcess({
  app,
  apiKey,
  developerPlatformClient,
  ...options
}: Omit<DevSessionOptions, 'extensions'>): Promise<DevSessionProcess | undefined> {
  const draftableExtensions = app.draftableExtensions
  if (draftableExtensions.length === 0) {
    return
  }

  return {
    type: 'dev-session',
    prefix: 'extensions',
    function: pushUpdatesForDevSession,
    options: {
      app,
      apiKey,
      developerPlatformClient,
      ...options,
      extensions: draftableExtensions,
    },
  }
}

export const pushUpdatesForDevSession: DevProcessFunction<DevSessionOptions> = async (
  {stderr, stdout, abortSignal: signal},
  options,
) => {
  // Force the download of the javy binary in advance to avoid later problems,
  // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
  const {developerPlatformClient, app} = options
  await installJavy(app)

  const dir = tempDirectory()
  const bundlePath = joinPath(dir, 'bundle')
  await mkdir(bundlePath)

  const processOptions = {...options, stderr, stdout, signal, bundlePath}
  const appWatcher = new AppEventWatcher(app, processOptions)

  outputWarn('-----> Running DEV on beta mode <-----')
  outputDebug(`Using temp dir: ${dir}`, stdout)
  processOptions.stdout.write('Preparing dev session...')

  await initialBuild(processOptions)
  await bundleExtensionsAndUpload(processOptions, false)

  appWatcher.onEvent(async (event) => {
    processOptions.stdout.write(`Event detected:`)
    event.extensionEvents.forEach((eve) => {
      processOptions.stdout.write(`🆕 ->> ${eve.type} :: ${eve.extension.handle} :: ${eve.extension.directory}`)
    })
    try {
      const buildPromises = event.extensionEvents
        .filter((eve) => eve.type === EventType.UpdatedSourceFile)
        .map((eve) => {
          return eve.extension.buildForBundle(
            {...processOptions, app: event.app, environment: 'development'},
            processOptions.bundlePath,
            undefined,
          )
        })
      await Promise.all(buildPromises)
      // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
    } catch (error: any) {
      processOptions.stderr.write('Error building extensions')
      processOptions.stderr.write(error.message)
    }

    await performActionWithRetryAfterRecovery(async () => {
      await bundleExtensionsAndUpload({...processOptions, app: event.app}, true)
    }, developerPlatformClient.refreshToken)

    const endTime = process.hrtime(event.startTime)
    processOptions.stdout.write(`Session updated [${endHRTimeInMs(endTime)}ms]`)
  })

  await appWatcher.start()
  processOptions.stdout.write(`Dev session ready, watching for changes in your app`)
}

// Build all extensions into the bundle path
async function initialBuild(options: DevSessionProcessOptions) {
  const allPromises = options.app.realExtensions.map((extension) => {
    return extension.buildForBundle(
      {...options, app: options.app, environment: 'development'},
      options.bundlePath,
      undefined,
    )
  })
  await Promise.all(allPromises)
}

async function bundleExtensionsAndUpload(options: DevSessionProcessOptions, updating: boolean) {
  // Build and bundle all extensions in a zip file (including the manifest file)
  const bundleZipPath = joinPath(dirname(options.bundlePath), `bundle.zip`)
  // options.stdout.write('Building manifest...')

  // Include manifest in bundle
  const appManifest = await options.app.manifest()
  const manifestPath = joinPath(options.bundlePath, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(appManifest, null, 2))

  // Create zip file with everything
  // options.stdout.write('Creating zip file...')
  await zip({
    inputDirectory: options.bundlePath,
    outputZipPath: bundleZipPath,
  })

  // Upload zip file to GCS
  // options.stdout.write('Getting signed URL...')
  const signedURL = await getExtensionUploadURL(options.developerPlatformClient, {
    apiKey: options.appId,
    organizationId: options.organizationId,
    id: options.appId,
  })

  // options.stdout.write('Uploading zip file...')
  const form = formData()
  const buffer = readFileSync(bundleZipPath)
  form.append('my_upload', buffer)
  await fetch(signedURL, {
    method: 'put',
    body: buffer,
    headers: form.getHeaders(),
  })

  const payload = {
    shopName: options.storeFqdn,
    appId: options.appId,
    assetsUrl: signedURL,
  }

  // options.stdout.write('Creating/Updating dev session...')
  let errors: {message: string}[] | undefined
  if (updating) {
    const result = await options.developerPlatformClient.devSessionUpdate(payload)
    errors = result.devSessionUpdate?.userErrors
  } else {
    const result = await options.developerPlatformClient.devSessionCreate(payload)
    errors = result.devSessionCreate?.userErrors
  }

  if (errors && errors.length > 0) {
    options.stderr.write('Dev Session Error')
    options.stderr.write(JSON.stringify(errors, null, 2))
  }
}

import {LoadedAppContextOutput} from './app-context.js'
import {getBundleSize} from './build/bundle-size.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {isRemoteDomExtension} from '../models/extensions/specifications/ui_extension.js'
import {UiExtensionSizeContextInput} from '../api/graphql/app-management/generated/types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {
  renderConcurrent,
  renderConfirmationPrompt,
  renderInfo,
  renderSuccess,
  renderTextPrompt,
  renderWarning,
} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

interface MeasuredExtension {
  extension: ExtensionInstance
  rawKb: number
  compressedKb: number
}

interface RequestBundleSizeExceptionOptions {
  appContextResult: LoadedAppContextOutput
  /** Justification for the exception. When provided, prompts are skipped (automation mode). */
  reason?: string
}

/**
 * Submits a bundle size exception request for the app's Remote-DOM UI extensions.
 *
 * The CLI measures each Remote-DOM UI extension locally (same deflate algorithm the platform
 * enforces) and submits the measurements with the partner's justification. Shopify reviews
 * every request and decides what to grant; the CLI never proposes a new limit.
 */
export async function requestBundleSizeException(options: RequestBundleSizeExceptionOptions): Promise<void> {
  const {app, remoteApp, developerPlatformClient} = options.appContextResult

  const extensions = remoteDomUiExtensions(app)
  if (extensions.length === 0) {
    throw new AbortError(
      'This app has no Remote-DOM UI extensions (API version 2025-10 or later).',
      'Bundle size exceptions only apply to UI extensions on API version 2025-10 or later.',
    )
  }

  const measured = await buildAndMeasure(app, extensions)
  const maxCompressedKb = Math.max(...measured.map((entry) => entry.compressedKb))

  const state = await developerPlatformClient.uiExtensionBundleSizeException(remoteApp)

  if (state.status === 'PENDING') {
    renderInfo({
      headline: 'A bundle size exception request is already pending review.',
      body: [
        'Shopify is reviewing your request. Once approved,',
        {command: 'shopify app deploy'},
        'will succeed with no further changes.',
      ],
    })
    return
  }

  if (maxCompressedKb <= state.effectiveLimitKb) {
    renderInfo({
      headline: 'No exception needed.',
      body: [
        `All Remote-DOM UI extension bundles are within the app's current ${state.effectiveLimitKb} KB (compressed) limit.`,
      ],
      customSections: [measuredSection(measured, state.effectiveLimitKb)],
    })
    return
  }

  const interactive = options.reason === undefined
  const reason =
    options.reason ??
    (await renderTextPrompt({
      message: "Why can't the bundle be reduced below the current limit (and what did you already try)?",
      validate: (value) => {
        if (value.trim().length < 10) return 'Please provide a meaningful justification (at least 10 characters).'
      },
    }))

  if (interactive) {
    const confirmed = await renderConfirmationPrompt({
      message: `Request a bundle size exception for this app? Shopify will review the request; your extensions and their measured sizes will be shared with the review team.`,
      confirmationMessage: 'Yes, submit the request',
      cancellationMessage: 'No, cancel',
    })
    if (!confirmed) return
  }

  const result = await developerPlatformClient.uiExtensionBundleSizeExceptionRequest(remoteApp, {
    reason,
    extensions: measured.map(toSizeContext),
  })

  const userErrors = result.userErrors ?? []
  if (userErrors.length > 0) {
    throw new AbortError(userErrors.map((error) => error.message).join('\n'))
  }

  renderSuccess({
    headline: 'Bundle size exception requested.',
    body: [
      'Shopify will review your request. Once approved,',
      {command: 'shopify app deploy'},
      'will succeed with no further changes.',
    ],
    nextSteps: [
      ['Re-run', {command: 'shopify app bundle-size-exception request'}, 'to check the review state.'],
      ['You can keep reducing your bundle size in the meantime.'],
    ],
  })
}

interface BundleSizeExceptionStatusOptions {
  appContextResult: LoadedAppContextOutput
}

/**
 * Shows the state of the app's bundle size exception request.
 *
 * Only reads the status and effective limit from the platform; it doesn't build or
 * measure anything, so it's fast enough to poll while a request is under review.
 */
export async function bundleSizeExceptionStatus(options: BundleSizeExceptionStatusOptions): Promise<void> {
  const {remoteApp, developerPlatformClient} = options.appContextResult

  const state = await developerPlatformClient.uiExtensionBundleSizeException(remoteApp)
  const limit = `${state.effectiveLimitKb} KB (compressed)`

  switch (state.status) {
    case 'GRANTED':
      renderSuccess({
        headline: 'Bundle size exception granted.',
        body: [`Remote-DOM UI extension bundles up to ${limit} will pass deploy validation.`],
      })
      break
    case 'PENDING':
      renderInfo({
        headline: 'Bundle size exception request pending review.',
        body: [
          `The current limit is ${limit}. Shopify is reviewing your request; once approved,`,
          {command: 'shopify app deploy'},
          'will succeed with no further changes.',
        ],
      })
      break
    case 'DENIED':
      renderWarning({
        headline: 'Bundle size exception request denied.',
        body: [
          `A previous request for this app was denied or revoked, and the current limit is ${limit}.`,
          'Contact Shopify support to appeal.',
        ],
      })
      break
    case 'NONE':
      renderInfo({
        headline: 'No bundle size exception.',
        body: [`Remote-DOM UI extension bundles are limited to ${limit}.`],
        nextSteps: [
          ['Run', {command: 'shopify app bundle-size-exception request'}, "if your bundle can't fit the limit."],
        ],
      })
  }
}

function measuredSection(measured: MeasuredExtension[], effectiveLimitKb: number) {
  return {
    title: 'Measured extension bundles (compressed with the same algorithm Shopify enforces)',
    body: {
      list: {
        items: measured.map((entry) => {
          const overLimit = entry.compressedKb > effectiveLimitKb
          const flag = overLimit ? ' — exceeds the limit' : ''
          return `${entry.extension.handle}: ${entry.compressedKb} KB compressed (${entry.rawKb} KB raw)${flag}`
        }),
      },
    },
  }
}

function remoteDomUiExtensions(app: AppLinkedInterface): ExtensionInstance[] {
  return app.allExtensions.filter(
    (extension) =>
      extension.specification.identifier === 'ui_extension' && isRemoteDomExtension(extension.configuration),
  )
}

/**
 * Builds the given UI extensions for production (minified, matching what a deploy uploads)
 * into a temporary directory and measures each bundle's raw and deflate-compressed size.
 */
async function buildAndMeasure(app: AppLinkedInterface, extensions: ExtensionInstance[]): Promise<MeasuredExtension[]> {
  return inTemporaryDirectory(async (bundleDirectory) => {
    await renderConcurrent({
      processes: extensions.map((extension) => ({
        prefix: extension.localIdentifier,
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          await extension.buildForBundle({stderr, stdout, signal, app, environment: 'production'}, bundleDirectory)
        },
      })),
      showTimestamps: false,
    })

    return Promise.all(
      extensions.map(async (extension) => {
        const {rawBytes, compressedBytes} = await getBundleSize(extension.outputPath)
        return {
          extension,
          // Ceil so the requested exception always covers the measured bytes.
          rawKb: Math.ceil(rawBytes / 1024),
          compressedKb: Math.ceil(compressedBytes / 1024),
        }
      }),
    )
  })
}

function toSizeContext(entry: MeasuredExtension): UiExtensionSizeContextInput {
  const extensionPoints = (entry.extension.configuration.extension_points ?? []) as {target?: string}[]
  return {
    uid: entry.extension.uid,
    handle: entry.extension.handle,
    apiVersion: entry.extension.configuration.api_version ?? 'unknown',
    rawKb: entry.rawKb,
    compressedKb: entry.compressedKb,
    targets: extensionPoints.map((point) => point.target).filter((target): target is string => Boolean(target)),
  }
}

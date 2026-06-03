import {loadApp} from '../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import metadata from '../../metadata.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

const REQUIREMENTS_URL = 'https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements'

export interface GetReviewRequirementsOptions {
  directory: string
  configName?: string
}

/**
 * Fetches the canonical App Store self-review requirements markdown from
 * shopify.dev and returns it as a string. Best-effort loads the local app so
 * the auto-emitted Monorail event carries app-level attribution (api_key,
 * app_path_hash, app_scopes, etc.).
 *
 * Designed to be invoked by the `shopify-app-review` agent skill in the
 * Shopify AI Toolkit: the skill shells out to
 * `shopify app get-review-requirements`, captures stdout, and uses it as the
 * live list of requirements to evaluate the codebase against.
 */
export async function getReviewRequirements(options: GetReviewRequirementsOptions): Promise<string> {
  await loadAppForAttribution(options)

  const markdown = await fetchRequirementsMarkdown()
  return markdown
}

async function loadAppForAttribution(options: GetReviewRequirementsOptions): Promise<void> {
  try {
    const app = await loadApp({
      directory: options.directory,
      userProvidedConfigName: options.configName,
      specifications: await loadLocalExtensionsSpecifications(),
      remoteFlags: undefined,
      skipPrompts: true,
    })

    if (app.configuration.client_id) {
      await metadata.addPublicMetadata(() => ({
        api_key: String(app.configuration.client_id),
      }))
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(
      `Skipping app attribution for review-requirements fetch: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

async function fetchRequirementsMarkdown(): Promise<string> {
  const response = await fetch(
    REQUIREMENTS_URL,
    {
      headers: {
        Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1',
        'User-Agent': `Shopify CLI/${CLI_KIT_VERSION} (app get-review-requirements)`,
      },
    },
    'non-blocking',
  )

  if (!response.ok) {
    await metadata.addPublicMetadata(() => ({
      cmd_app_review_requirements_fetch_status: response.status,
    }))
    throw new AbortError(
      `Failed to fetch App Store self-review requirements from shopify.dev (HTTP ${response.status} ${response.statusText}).`,
      `Check your network connection and try again, or visit ${REQUIREMENTS_URL} directly.`,
    )
  }

  const body = await response.text()

  await metadata.addPublicMetadata(() => ({
    cmd_app_review_requirements_fetch_status: response.status,
  }))

  return body
}

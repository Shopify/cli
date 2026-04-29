import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {AbortError} from '@shopify/cli-kit/node/error'

const REQUIREMENTS_URL = 'https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements'

// Sentinel comment prepended to the response so an agent can confirm it parsed the expected command's output.
const SENTINEL = '<!-- shopify-agent: get-self-review-requirements -->'

interface GetSelfReviewRequirementsInput {
  cliVersion: string
}

export async function getSelfReviewRequirementsMarkdown({cliVersion}: GetSelfReviewRequirementsInput): Promise<string> {
  const response = await shopifyFetch(REQUIREMENTS_URL, {
    method: 'GET',
    headers: {
      Accept: 'text/markdown',
      'User-Agent': `shopify-cli/${cliVersion}`,
    },
  })

  if (!response.ok) {
    await addPublicMetadata(() => ({cmd_app_agent_upstream_status: response.status}))
    throw new AbortError(`Failed to fetch self-review requirements: HTTP ${response.status}`)
  }

  const body = await response.text()

  await addPublicMetadata(() => ({
    cmd_app_agent_upstream_status: response.status,
    cmd_app_agent_response_bytes: body.length,
  }))

  return `${SENTINEL}\n\n${body}`
}

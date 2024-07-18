import {render} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

export async function evaluate(
  themeSession: DevServerSession,
  snippet: string,
  themeId: string,
  url: string,
): Promise<string | undefined> {
  const result = await evaluateResult(themeSession, themeId, snippet, url)
  try {
    return sanitizeResult(result)
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputInfo(outputContent`${outputToken.errorText(error.message)}`)
  }
}

async function evaluateResult(themeSession: DevServerSession, themeId: string, snippet: string, url: string) {
  outputDebug(`Evaluating snippet - ${snippet}`)
  const response = await render(themeSession, {
    path: url,
    query: [],
    themeId,
    cookies: '',
    sectionId: 'announcement-bar',
    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `{{ ${snippet} | json }}`,
    },
  })

  return response.text()
}

function sanitizeResult(result: string) {
  const regex = />([^<]+)</
  const match = result.match(regex)

  if (match && match[1]) {
    return JSON.parse(match[1])
  }
}

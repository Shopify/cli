import {render} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

export interface SessionItem {
  type: string
  value: string
}

export interface EvaluationConfig {
  themeSession: DevServerSession
  themeId: string
  url: string
  replSession: SessionItem[]
  snippet: string
}

export async function evaluate(config: EvaluationConfig): Promise<string | number | undefined> {
  return (
    (await evalResult(config)) ||
    (await evalContext(config)) ||
    (await evalAssignmentContext(config)) ||
    (await evalSyntaxError(config)) ||
    undefined
  )
}

async function evalResult(config: EvaluationConfig) {
  outputDebug(`Evaluating snippet - ${config.snippet}`)

  const input = `{ "type": "display", "value": {{ ${config.snippet} | json }} }`
  const request = await makeRequest({...config, snippet: input})
  const text = await request.text()

  return successfulRequest(request.status, text) ? parseDisplayResult(text) : undefined
}

async function evalContext(config: EvaluationConfig) {
  outputDebug(`Evaluating context - ${config.snippet}`)

  const json = `{ "type": "context", "value": "{% ${config.snippet.replace(/"/g, '\\"')} %}" }`
  const request = await makeRequest({...config, snippet: json})
  const text = await request.text()

  if (successfulRequest(request.status, text)) {
    config.replSession.push(JSON.parse(json))
  }
}

async function evalAssignmentContext(config: EvaluationConfig) {
  outputDebug(`Evaluating assignment context - ${config.snippet}`)

  if (isSmartAssignment(config.snippet)) {
    config.snippet = `assign ${config.snippet}`
    outputInfo(outputContent`${outputToken.gray(`> ${config.snippet}`)}`)
    return evalContext(config)
  }
}

async function evalSyntaxError(config: EvaluationConfig) {
  outputDebug(`Evaluating syntax error - ${config.snippet}`)

  let body = ''
  if (!isStandardAssignment(config.snippet)) {
    const response = await makeRequest({...config, snippet: `{{ ${config.snippet} }}`})
    body = await response.text()
  }

  if (!hasLiquidError(body)) {
    const response = await makeRequest({...config, snippet: `{% ${config.snippet} %}`})
    body = await response.text()
  }

  if (hasLiquidError(body)) {
    const error = body.replace(/ \(snippets\/eval line \d+\)/, '')
    printSyntaxError(config.snippet, error)
  }
}

function printSyntaxError(snippet: string, error: string) {
  if (error.includes('Unknown tag')) {
    outputInfo(outputContent`${outputToken.errorText(`Unknown object, property, tag, or filter: '${snippet}'`)}`)
    return
  }

  const resultContent = stripHTMLContent(error)
  if (resultContent) {
    outputInfo(outputContent`${outputToken.errorText(resultContent)}`)
  }
}

async function makeRequest(config: EvaluationConfig): Promise<Response> {
  const requestBody = buildRequestBody(config)

  if (!config.url.startsWith('/')) {
    config.url = `/${config.url}`
  }

  const response = await render(config.themeSession, {
    method: 'GET',
    path: config.url,
    query: [],
    themeId: config.themeId,
    sectionId: 'announcement-bar',
    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `{% render 'eval' %}`,
      'snippets/eval.liquid': `\n${requestBody}\n`,
    },
  })

  if (isExpiredSession(response)) {
    expiredSessionError()
  }

  if (isTooManyRequests(response)) {
    tooManyRequestsError()
  }

  if (isResourceNotFound(response)) {
    notFoundError()
  }

  return response
}

function buildRequestBody(config: EvaluationConfig): string {
  const items = [...config.replSession.map((item) => JSON.stringify(item)), config.snippet]
  return `[${items.join(',').replace(/\\"/g, '"')}]`
}

function parseDisplayResult(result: string): string | number | undefined {
  const resultContent = stripHTMLContent(result)
  if (resultContent) {
    const displayObject = JSON.parse(resultContent)?.find((item: SessionItem) => item.type === 'display')
    return displayObject?.value
  }
}

function stripHTMLContent(result: string): undefined | string {
  const splitResult = result.split('\n').slice(1, -1)
  if (splitResult.length === 0) return

  return splitResult.join('')
}

function hasLiquidError(body: string): boolean {
  return body.includes('Liquid syntax error')
}

function isStandardAssignment(input: string): boolean {
  const regex = /^\s*assign\s*((?:\(?[\w\-.[\]]\)?)+)\s*=\s*(.*)\s*/m
  return regex.test(input)
}

function isExpiredSession(response: Response): boolean {
  return response.status === 401 || response.status === 403
}

function isTooManyRequests(response: Response): boolean {
  return response.status === 430 || response.status === 429
}

function isResourceNotFound(response: Response): boolean {
  // We don't look for the status code here because the Section Rendering API returns 200 even on unknown paths.
  return response.headers.get('server-timing')?.includes('pageType;desc="404"') || false
}

function expiredSessionError(): never {
  throw new AbortError('Session expired. Please initiate a new one.')
}

function tooManyRequestsError(): never {
  throw new AbortError('Evaluations limit reached. Try again later.')
}

function notFoundError(): never {
  throw new AbortError('Page not found. Please provide a valid --url value!')
}

function isSmartAssignment(input: string): boolean {
  const regex = /^\s*((?:\(?[\w\-.[\]]\)?)+)\s*=\s*(.*)\s*/m
  return regex.test(input)
}

function successfulRequest(status: number, text: string) {
  return status === 200 && !hasLiquidError(text)
}

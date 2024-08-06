import {render} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
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
  try {
    return evaluateSnippet(config)

    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputInfo(outputContent`${outputToken.errorText(error.message)}`)
    outputDebug(error.stack || 'Error backtrace not found')
  }
}

async function evaluateSnippet(config: EvaluationConfig): Promise<string | number | undefined> {
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
  const {status, text} = await makeRequest({...config, snippet: input})

  return successfulRequest(status, text) ? parseDisplayResult(text) : undefined
}

async function evalContext(config: EvaluationConfig) {
  outputDebug(`Evaluating context - ${config.snippet}`)

  const json = `{ "type": "context", "value": "{% ${config.snippet.replace(/"/g, '\\"')} %}" }`
  const {status, text} = await makeRequest({...config, snippet: json})

  if (successfulRequest(status, text)) {
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
    const {text} = await makeRequest({...config, snippet: `{{ ${config.snippet} }}`})
    body = text
  }

  if (!hasLiquidError(body)) {
    const {text} = await makeRequest({...config, snippet: `{% ${config.snippet} %}`})
    body = text
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

  const match = stripHTMLContent(error)
  if (match && match[1]) {
    outputInfo(outputContent`${outputToken.errorText(match[1])}`)
  }
}

async function makeRequest(config: EvaluationConfig): Promise<{text: string; status: number}> {
  const requestBody = buildRequestBody(config)
  const response = await sendRenderRequest(config, requestBody)
  return {text: await response.text(), status: response.status}
}

function buildRequestBody(config: EvaluationConfig): string {
  const items = [...config.replSession.map((item) => JSON.stringify(item)), config.snippet]
  return `[${items.join(',').replace(/\\"/g, '"')}]`
}

async function sendRenderRequest(config: EvaluationConfig, requestBody: string) {
  const response = await render(config.themeSession, {
    path: config.url,
    query: [],
    themeId: config.themeId,
    cookies: '',
    sectionId: 'announcement-bar',
    headers: {},
    replaceTemplates: {
      'sections/announcement-bar.liquid': `\n{% render 'eval' %}`,
      'snippets/eval.liquid': requestBody,
    },
  })

  if (isExpiredSession(response.status)) {
    expiredSessionError()
  }

  if (isTooManyRequests(response.status)) {
    tooManyRequestsError()
  }

  const serverTiming = response.headers.get('server-timing')
  if (isResourceNotFound(serverTiming || '')) {
    notFoundError()
  }

  return response
}

function parseDisplayResult(result: string): string | number | undefined {
  const match = stripHTMLContent(result)
  if (!match || !match[1]) return

  const displayObject = JSON.parse(match[1])?.find((item: SessionItem) => item.type === 'display')
  return displayObject?.value
}

function stripHTMLContent(result: string) {
  return result.match(/>([^<]+)</)
}

function hasLiquidError(body: string): boolean {
  return /Liquid syntax error/.test(body)
}

function isStandardAssignment(input: string): boolean {
  const regex = /^\s*assign\s*((?:\(?[\w\-.[\]]\)?)+)\s*=\s*(.*)\s*/m
  return regex.test(input)
}

function isExpiredSession(responseStatus: number): boolean {
  return responseStatus === 401 || responseStatus === 403
}

function isTooManyRequests(responseStatus: number): boolean {
  return responseStatus === 430 || responseStatus === 429
}

function isResourceNotFound(serverTiming: string): boolean {
  // We don't look for the status code here because the Section Rendering API returns 200 even on unknown paths.
  return serverTiming.includes('pageType;desc="404"')
}

function expiredSessionError(): never {
  outputInfo(outputContent`${outputToken.errorText('Session expired. Please initiate a new one.')}`)
  throw new AbortSilentError()
}

function tooManyRequestsError(): never {
  outputInfo(outputContent`${outputToken.errorText('Evaluations limit reached. Try again later.')}`)
  throw new AbortSilentError()
}

function notFoundError(): never {
  outputInfo(outputContent`${outputToken.errorText('Page not found. Please provide a valid --url value.')}`)
  throw new AbortSilentError()
}

function isSmartAssignment(input: string): boolean {
  const regex = /^\s*((?:\(?[\w\-.[\]]\)?)+)\s*=\s*(.*)\s*/m
  return regex.test(input)
}

function successfulRequest(status: number, text: string) {
  return status === 200 && !hasLiquidError(text)
}

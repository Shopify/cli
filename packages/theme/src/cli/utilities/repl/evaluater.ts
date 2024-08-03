import {render} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {consoleLog, outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

export interface SessionItem {
  type: string
  value: string
}

export interface EvaluationConfig {
  themeSession: DevServerSession
  themeId: string
  url: string
  replSession: SessionItem[]
}

export async function evaluate(snippet: string, config: EvaluationConfig): Promise<string | number | undefined> {
  try {
    return evaluateSnippet(config, snippet)

    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputInfo(outputContent`${outputToken.errorText(error.message)}`)
    outputDebug(error.stack || 'Error backtrace not found')
  }
}

async function evaluateSnippet(config: EvaluationConfig, snippet: string): Promise<string | number | undefined> {
  return (
    (await evalResult(config, snippet)) ||
    (await evalContext(config, snippet)) ||
    (await evalAssignmentContext(config, snippet)) ||
    undefined
  )
}

async function evalResult(config: EvaluationConfig, snippet: string) {
  outputDebug(`Evaluating snippet - ${snippet}`)

  const input = `{ "type": "display", "value": {{ ${snippet} | json }} }`
  const {status, text} = await makeRequest(config, input)

  return successfulRequest(status, text) ? parseDisplayResult(text) : undefined
}

async function evalContext(config: EvaluationConfig, snippet: string) {
  outputDebug(`Evaluating context - ${snippet}`)

  const json = `{ "type": "context", "value": "{% ${snippet.replace(/"/g, '\\"')} %}" }`
  const {status, text} = await makeRequest(config, json)

  if (successfulRequest(status, text)) {
    consoleLog(text)
    consoleLog(JSON.parse(json))
    config.replSession.push(JSON.parse(json))
  }
}

async function evalAssignmentContext(config: EvaluationConfig, snippet: string) {
  outputDebug(`Evaluating assignment context - ${snippet}`)

  return isSmartAssignment(snippet) ? evalContext(config, `assign ${snippet}`) : undefined
}

async function makeRequest(config: EvaluationConfig, snippet: string): Promise<{text: string; status: number}> {
  const requestBody = buildRequestBody(config.replSession, snippet)
  const response = await sendRenderRequest(config, requestBody)
  return {text: await response.text(), status: 200}
}

function buildRequestBody(session: SessionItem[], snippet: string): string {
  const items = [...session.map((item) => JSON.stringify(item)), snippet]
  return `[${items.join(',').replace(/\\"/g, '"')}]`
}

async function sendRenderRequest(config: EvaluationConfig, requestBody: string) {
  return render(config.themeSession, {
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
}

function isSmartAssignment(input: string): boolean {
  const regex = /^\s*((?:\(?[\w\-.[\]]\)?)+)\s*=\s*(.*)\s*/m
  return regex.test(input)
}

function successfulRequest(status: number, text: string) {
  return status === 200 && !hasLiquidError(text)
}

function hasLiquidError(body: string): boolean {
  return /Liquid syntax error/.test(body)
}

function parseDisplayResult(result: string): string | number | undefined {
  const match = result.match(/>([^<]+)</)
  if (!match || !match[1]) return

  const displayObject = JSON.parse(match[1])?.find((item: SessionItem) => item.type === 'display')
  return displayObject?.value
}

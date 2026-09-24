import {renderThemePreviewResult, renderThemePreviewOpenError} from './result.js'
import {expect, test, vi} from 'vitest'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

const result = {url: 'https://abc123.shopifypreview.com', preview_identifier: 'abc123'}

test.each([false, true])('preserves the success banner with updated=%s', (updated) => {
  renderThemePreviewResult(result, 'text', updated)

  expect(renderSuccess).toHaveBeenCalledWith({
    body: [
      {
        list: {
          title: updated ? 'Preview updated' : 'Preview is ready',
          items: [{link: {url: result.url}}, `Preview ID: ${result.preview_identifier}`],
        },
      },
    ],
  })
})

test('preserves the browser warning in text mode', () => {
  const error = new Error('Browser unavailable')
  renderThemePreviewOpenError(error, 'text')

  expect(renderWarning).toHaveBeenCalledWith({headline: 'Failed to open theme preview.', body: error.stack})
})

test('sends browser failures as diagnostic events to stderr', async () => {
  const error = new Error('Browser unavailable')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => renderThemePreviewOpenError(error, 'json'))

    expect(stdout()).toBe('')
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'warning',
      message: `Failed to open theme preview.\n${error.stack}`,
    })
  })
  expect(renderWarning).not.toHaveBeenCalled()
})

test('preserves compact JSON on stderr outside the command event context', async () => {
  await withCapturedStandardStreams(({stdout, stderr}) => {
    renderThemePreviewResult(result, 'json', false)

    expect(stdout()).toBe('')
    expect(stderr()).toBe('{"url":"https://abc123.shopifypreview.com","preview_identifier":"abc123"}\n')
  })
  expect(renderSuccess).not.toHaveBeenCalled()
})

test('preserves the existing JSON diagnostic wrapper during the command lifecycle', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => renderThemePreviewResult(result, 'json', false))

    expect(stdout()).toBe('')
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'info',
      message: '{"url":"https://abc123.shopifypreview.com","preview_identifier":"abc123"}',
    })
  })
  expect(renderSuccess).not.toHaveBeenCalled()
})

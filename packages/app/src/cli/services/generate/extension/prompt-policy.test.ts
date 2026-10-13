import generateExtensionPrompts from '../../../prompts/generate/extension.js'
import {checkoutUITemplate, testApp} from '../../../models/app/app.test-data.js'
import {afterEach, expect, test, vi} from 'vitest'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {render} from '@shopify/cli-kit/node/ui'

vi.mock('../../../../../../cli-kit/src/private/node/ui.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../cli-kit/src/private/node/ui.js')>()
  return {
    ...actual,
    render: vi.fn(async (component: {props: {onSubmit: (value: string) => void}}) => {
      component.props.onSubmit('typescript')
    }),
  }
})

afterEach(() => vi.unstubAllEnvs())

test.each([false, true])('JSON preserves the missing-flavor prompt policy with no-input: %s', async (noInput) => {
  const stdinIsTTY = process.stdin.isTTY
  const stderrIsTTY = process.stderr.isTTY
  Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true, writable: true})
  Object.defineProperty(process.stderr, 'isTTY', {value: true, configurable: true, writable: true})
  vi.stubEnv('CI', '')
  if (noInput) vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')

  try {
    await inTemporaryDirectory(async (directory) => {
      const result = runWithCommandEventsForCommand(['--json', ...(noInput ? ['--no-input'] : [])], () =>
        generateExtensionPrompts({
          app: testApp({directory}),
          directory,
          name: 'My extension',
          templateType: checkoutUITemplate.identifier,
          extensionTemplates: [checkoutUITemplate],
          unavailableExtensions: [],
          reset: false,
        }),
      )
      if (noInput) {
        await expect(result).rejects.toThrow('What would you like to work in?')
        expect(render).not.toHaveBeenCalled()
      } else {
        await expect(result).resolves.toMatchObject({extensionContent: {name: 'My extension', flavor: 'typescript'}})
        expect(render).toHaveBeenCalledWith(
          expect.objectContaining({props: expect.objectContaining({message: 'What would you like to work in?'})}),
          expect.objectContaining({stdout: process.stderr}),
        )
      }
    })
  } finally {
    Object.defineProperty(process.stdin, 'isTTY', {value: stdinIsTTY, configurable: true, writable: true})
    Object.defineProperty(process.stderr, 'isTTY', {value: stderrIsTTY, configurable: true, writable: true})
  }
})

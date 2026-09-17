import {renderDeprecatedCommandWarning} from './deprecated-command.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'

// Banners wrap their contents to the terminal width, so assertions run against a single flat line.
function unwrap(output: string): string {
  return output.replace(/[│╭╮╰╯─]/g, ' ').replace(/\s+/g, ' ')
}

describe('renderDeprecatedCommandWarning', () => {
  test('names both the old and the new command path', () => {
    const outputMock = mockAndCaptureOutput()

    renderDeprecatedCommandWarning({from: 'app import-extensions', to: 'app import dashboard-extensions'})

    expect(unwrap(outputMock.warn())).toContain('`shopify app import-extensions` has moved.')
    expect(unwrap(outputMock.warn())).toContain(
      'This command will be removed in a future release. Use `shopify app import dashboard-extensions` instead.',
    )
  })
})

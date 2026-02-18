import {detectCliCommand} from './context.js'
import {describe, expect, test} from 'vitest'

describe('detectCliCommand', () => {
  const handle = 'doctor-release:theme'

  test('returns shopify when no handle is provided', () => {
    expect(detectCliCommand(undefined, ['node', 'shopify', 'doctor-release', 'theme'])).toBe('shopify')
  })

  test('detects npx shopify', () => {
    const argv = ['npx', 'shopify', 'doctor-release', 'theme']
    expect(detectCliCommand(handle, argv)).toBe('npx shopify')
  })

  test('detects direct shopify invocation', () => {
    const argv = ['shopify', 'doctor-release', 'theme']
    expect(detectCliCommand(handle, argv)).toBe('shopify')
  })

  test('detects pnpm shopify', () => {
    const argv = ['pnpm', 'shopify', 'doctor-release', 'theme']
    expect(detectCliCommand(handle, argv)).toBe('pnpm shopify')
  })

  test('detects node packages/cli/bin/dev.js', () => {
    const argv = ['node', 'packages/cli/bin/dev.js', 'doctor-release', 'theme']
    expect(detectCliCommand(handle, argv)).toBe('node packages/cli/bin/dev.js')
  })

  test('returns shopify when handle has no colon', () => {
    const argv = ['node', 'shopify', 'doctor-release', 'theme']
    expect(detectCliCommand('doctor-release', argv)).toBe('node shopify')
  })

  test('returns shopify when first topic is not found in argv', () => {
    const argv = ['node', 'shopify', 'theme', 'init']
    expect(detectCliCommand(handle, argv)).toBe('shopify')
  })

  test('returns shopify when first topic is the first argv element', () => {
    const argv = ['doctor-release', 'theme']
    expect(detectCliCommand(handle, argv)).toBe('shopify')
  })
})

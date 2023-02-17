import {outputToken, shouldDisplayColors} from './output.js'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

describe('Output helpers', () => {
  it('can format dependency manager commands with flags', () => {
    expect(outputToken.packagejsonScript('yarn', 'dev', '--reset').value).toEqual('yarn dev --reset')
    expect(outputToken.packagejsonScript('npm', 'dev', '--reset').value).toEqual('npm run dev -- --reset')
    expect(outputToken.packagejsonScript('pnpm', 'dev', '--reset').value).toEqual('pnpm dev --reset')
  })
  it('can format dependency manager commands without flags', () => {
    expect(outputToken.packagejsonScript('yarn', 'dev').value).toEqual('yarn dev')
    expect(outputToken.packagejsonScript('npm', 'dev').value).toEqual('npm run dev')
    expect(outputToken.packagejsonScript('pnpm', 'dev').value).toEqual('pnpm dev')
  })
})

describe('shouldDisplayColors', () => {
  beforeEach(() => {
    process.stdout.isTTY = true
  })

  afterEach(() => {
    process.stdout.isTTY = false
  })

  it('returns true in TTY', () => {
    // GIVEN
    const env = {}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeTruthy()
  })

  it('returns true when FORCE_COLOR is set', () => {
    // GIVEN
    process.stdout.isTTY = false
    const env = {FORCE_COLOR: '1'}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeTruthy()
  })

  it('returns false when NO_COLOR is set', () => {
    // GIVEN
    const env = {NO_COLOR: '1'}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeFalsy()
  })

  it('returns false when SHOPIFY_FLAG_NO_COLOR is set', () => {
    // GIVEN
    const env = {SHOPIFY_FLAG_NO_COLOR: '1'}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeFalsy()
  })

  it('returns false when --no-color is set', () => {
    // GIVEN
    const originalArgv = process.argv
    process.argv = ['--no-color']
    const env = {}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeFalsy()
    process.argv = originalArgv
  })

  it('returns false when TERM is dumb', () => {
    // GIVEN
    const env = {TERM: 'dumb'}

    // WHEN/THEN
    expect(shouldDisplayColors(env)).toBeFalsy()
  })
})

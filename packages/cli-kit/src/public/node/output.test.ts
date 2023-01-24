import {outputToken} from './output.js'
import {describe, expect, it} from 'vitest'

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

import {token} from './output'
import {describe, expect, it} from 'vitest'

describe('Output helpers', () => {
  it('can format dependency manager commands with flags', () => {
    expect(token.packagejsonScript('yarn', 'dev', '--reset').value).toEqual('yarn dev --reset')
    expect(token.packagejsonScript('npm', 'dev', '--reset').value).toEqual('npm run dev -- --reset')
    expect(token.packagejsonScript('pnpm', 'dev', '--reset').value).toEqual('pnpm run dev -- --reset')
  })
  it('can format dependency manager commands without flags', () => {
    expect(token.packagejsonScript('yarn', 'dev').value).toEqual('yarn dev')
    expect(token.packagejsonScript('npm', 'dev').value).toEqual('npm run dev')
    expect(token.packagejsonScript('pnpm', 'dev').value).toEqual('pnpm run dev')
  })
})

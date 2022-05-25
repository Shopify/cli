import {token} from './output'
import {describe, expect, it} from 'vitest'

describe('Output helpers', () => {
  it('can format dependency manager commands', () => {
    expect(token.command('yarn', 'dev --reset').value).toEqual('yarn dev --reset')
    expect(token.command('npm', 'dev --reset').value).toEqual('npm run dev --reset')
    expect(token.command('pnpm', 'dev --reset').value).toEqual('pnpm run dev --reset')
  })
})

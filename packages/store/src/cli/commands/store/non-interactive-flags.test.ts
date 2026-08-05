import StoreCreateDev from './create/dev.js'
import StoreDelete from './delete.js'
import StoreList from './list.js'
import {describe, expect, test} from 'vitest'

describe('non-interactive store command flags', () => {
  test.each([
    {command: StoreCreateDev, flag: 'name'},
    {command: StoreCreateDev, flag: 'organization-id'},
    {command: StoreCreateDev, flag: 'plan'},
  ])('$command.name marks --$flag as required', ({command, flag}) => {
    const flags = command.flags as Record<string, {description?: string; requiredIfNonInteractive?: boolean}>
    expect(flags[flag]!.requiredIfNonInteractive).toBe(true)
    expect(flags[flag]!.description).toMatch(/Required if non interactive\.$/)
  })

  test('store delete documents its custom non-interactive JSON error requirement', () => {
    expect(StoreDelete.flags.force.description).toMatch(/Required if non interactive\.$/)
  })

  test('store list documents its runtime-dependent organization requirement', () => {
    expect(StoreList.flags['organization-id'].description).toMatch(
      /Required if non interactive when more than one organization is available\.$/,
    )
  })
})

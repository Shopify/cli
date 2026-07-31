import Delete from './delete.js'
import Duplicate from './duplicate.js'
import Open from './open.js'
import Publish from './publish.js'
import Pull from './pull.js'
import Push from './push.js'
import Rename from './rename.js'
import {describe, expect, test} from 'vitest'

describe('non-interactive theme command flags', () => {
  test.each([
    {command: Delete, flag: 'force'},
    {command: Duplicate, flag: 'theme'},
    {command: Publish, flag: 'force'},
    {command: Publish, flag: 'theme'},
    {command: Rename, flag: 'name'},
  ])('$command.name documents --$flag as required', ({command, flag}) => {
    const flags = command.flags as Record<string, {description?: string}>
    expect(flags[flag]!.description).toMatch(/Required if non interactive\.$/)
  })

  test.each([
    {command: Delete, requirements: [{flags: ['theme', 'development', 'show-all']}]},
    {command: Open, requirements: [{flags: ['theme', 'development', 'live']}]},
    {command: Pull, requirements: [{flags: ['theme', 'development', 'live']}]},
    {command: Rename, requirements: [{flags: ['theme', 'development', 'live']}]},
  ])('$command.name accepts any theme selector', ({command, requirements}) => {
    expect(command.nonTTYFlagRequirements()).toEqual(requirements)
  })

  test.each([
    {
      command: Delete,
      selectors: ['show-all', 'development', 'theme'],
      guidance: 'Use --show-all, --development, or --theme in non-interactive environments.',
    },
    {
      command: Open,
      selectors: ['development', 'live', 'theme'],
      guidance: 'Use --development, --live, or --theme in non-interactive environments.',
    },
    {
      command: Pull,
      selectors: ['development', 'live', 'theme'],
      guidance: 'Use --development, --live, or --theme in non-interactive environments.',
    },
    {
      command: Push,
      selectors: ['development', 'live', 'theme', 'unpublished'],
      guidance: 'Use --development, --live, --theme, or --unpublished in non-interactive environments.',
    },
    {
      command: Rename,
      selectors: ['development', 'live', 'theme'],
      guidance: 'Use --development, --live, or --theme in non-interactive environments.',
    },
  ])('$command.name consistently documents its theme selectors', ({command, selectors, guidance}) => {
    const flags = command.flags as Record<string, {description?: string}>
    selectors.forEach((selector) => expect(flags[selector]!.description).toContain(guidance))
  })

  test('theme duplicate requires confirmation bypass outside CI', () => {
    expect(Duplicate.nonTTYFlagRequirements()).toEqual([{flags: ['force'], when: expect.any(Function)}])
    expect(Duplicate.flags.force.description).toMatch(/Required if non interactive outside CI\.$/)
  })

  test('theme push requires a destination', () => {
    expect(Push.nonTTYFlagRequirements()).toEqual([
      {flags: ['theme', 'development', 'live', 'unpublished']},
      {flags: ['theme'], when: expect.any(Function)},
      {flags: ['allow-live'], when: expect.any(Function)},
    ])
  })

  test('theme push requires a name for a new unpublished theme', () => {
    const requirements = Push.nonTTYFlagRequirements()
    expect(requirements[1]!.when!({unpublished: true})).toBe(true)
    expect(requirements[1]!.when!({unpublished: true, development: true})).toBe(false)
  })

  test('theme push requires explicit permission for the live theme', () => {
    const requirements = Push.nonTTYFlagRequirements()
    expect(requirements[2]!.when!({live: true})).toBe(true)
    expect(requirements[2]!.when!({live: false})).toBe(false)
  })
})

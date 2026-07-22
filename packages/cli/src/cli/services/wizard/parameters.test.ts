import {
  optionalFlagParameters,
  promptKindForArg,
  promptKindForFlag,
  requiredArgParameters,
  requiredFlagGroups,
  requiredFlagParameters,
  validateInteger,
  validateNonEmpty,
  wizardArgParameters,
} from './parameters.js'
import {Command} from '@oclif/core'
import {describe, expect, test} from 'vitest'

function flag(props: {[key: string]: unknown}): Command.Flag.Any {
  return props as unknown as Command.Flag.Any
}

function arg(props: {[key: string]: unknown}): Command.Arg.Any {
  return props as unknown as Command.Arg.Any
}

describe('promptKindForFlag', () => {
  test('boolean flag maps to boolean', () => {
    expect(promptKindForFlag(flag({type: 'boolean'}))).toBe('boolean')
  })

  test('option flag with options maps to enum', () => {
    expect(promptKindForFlag(flag({type: 'option', options: ['a', 'b']}))).toBe('enum')
  })

  test('option flag with a numeric min/max maps to integer', () => {
    expect(promptKindForFlag(flag({type: 'option', min: 1}))).toBe('integer')
    expect(promptKindForFlag(flag({type: 'option', max: 10}))).toBe('integer')
  })

  test('a plain option flag maps to string', () => {
    expect(promptKindForFlag(flag({type: 'option'}))).toBe('string')
  })

  test('an option flag with an empty options array maps to string', () => {
    expect(promptKindForFlag(flag({type: 'option', options: []}))).toBe('string')
  })
})

describe('promptKindForArg', () => {
  test('arg with options maps to enum', () => {
    expect(promptKindForArg(arg({options: ['a', 'b']}))).toBe('enum')
  })

  test('arg without options maps to string', () => {
    expect(promptKindForArg(arg({}))).toBe('string')
  })
})

describe('requiredFlagParameters and optionalFlagParameters', () => {
  const flags = {
    name: flag({type: 'option', required: true, description: 'The name'}),
    reset: flag({type: 'boolean', description: 'Reset first'}),
    secret: flag({type: 'option', required: true, hidden: true}),
  }

  test('required returns only required, non-hidden flags with normalized shape', () => {
    expect(requiredFlagParameters(flags)).toEqual([
      {
        name: 'name',
        kind: 'string',
        description: 'The name',
        options: undefined,
        required: true,
        allowNo: false,
        defaultValue: undefined,
      },
    ])
  })

  test('optional returns only optional, non-hidden flags', () => {
    expect(optionalFlagParameters(flags)).toEqual([
      {
        name: 'reset',
        kind: 'boolean',
        description: 'Reset first',
        options: undefined,
        required: false,
        allowNo: false,
        defaultValue: undefined,
      },
    ])
  })
})

describe('boolean flag metadata', () => {
  test('carries allowNo and a literal boolean default', () => {
    const flags = {
      watch: flag({type: 'boolean', allowNo: true, default: true, description: 'Watch'}),
    }

    expect(optionalFlagParameters(flags)).toEqual([
      {
        name: 'watch',
        kind: 'boolean',
        description: 'Watch',
        options: undefined,
        required: false,
        allowNo: true,
        defaultValue: true,
      },
    ])
  })

  test('ignores a functional default and defaults allowNo to false', () => {
    const flags = {
      force: flag({type: 'boolean', default: () => false}),
    }

    const [parameter] = optionalFlagParameters(flags)
    expect(parameter?.allowNo).toBe(false)
    expect(parameter?.defaultValue).toBeUndefined()
  })
})

describe('requiredFlagGroups', () => {
  test('derives a de-duplicated exactlyOne group from its members', () => {
    // Given: both members carry the full `exactlyOne` list, as oclif emits it.
    const flags = {
      query: flag({type: 'option', exactlyOne: ['query', 'query-file'], description: 'Inline query'}),
      'query-file': flag({type: 'option', exactlyOne: ['query', 'query-file'], description: 'Query file'}),
    }

    // When
    const groups = requiredFlagGroups(flags)

    // Then
    expect(groups).toHaveLength(1)
    expect(groups[0]?.kind).toBe('exactlyOne')
    expect(groups[0]?.members.map((member) => member.name)).toEqual(['query', 'query-file'])
  })

  test('derives an atLeastOne group and drops hidden members', () => {
    const flags = {
      one: flag({type: 'option', atLeastOne: ['one', 'two', 'hidden']}),
      two: flag({type: 'option', atLeastOne: ['one', 'two', 'hidden']}),
      hidden: flag({type: 'option', atLeastOne: ['one', 'two', 'hidden'], hidden: true}),
    }

    const groups = requiredFlagGroups(flags)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.kind).toBe('atLeastOne')
    expect(groups[0]?.members.map((member) => member.name)).toEqual(['one', 'two'])
  })

  test('returns no groups when there are no relationship flags', () => {
    const flags = {name: flag({type: 'option', required: true})}
    expect(requiredFlagGroups(flags)).toEqual([])
  })
})

describe('requiredArgParameters', () => {
  test('returns required args in declared order with normalized shape', () => {
    // Given
    const args = {
      source: arg({required: true, description: 'Source'}),
      mode: arg({required: true, options: ['fast', 'slow']}),
      target: arg({description: 'Optional target'}),
    }

    // When
    const required = requiredArgParameters(args)

    // Then
    expect(required).toEqual([
      {name: 'source', kind: 'string', description: 'Source', options: undefined, required: true},
      {name: 'mode', kind: 'enum', description: undefined, options: ['fast', 'slow'], required: true},
    ])
  })
})

describe('wizardArgParameters', () => {
  test('skips hidden args', () => {
    // Given
    const args = {visible: arg({description: 'Shown'}), secret: arg({hidden: true})}

    // When / Then
    expect(wizardArgParameters(args).map((parameter) => parameter.name)).toEqual(['visible'])
  })
})

describe('validateNonEmpty', () => {
  test('rejects blank values', () => {
    expect(validateNonEmpty('   ')).toBe('This value is required.')
  })

  test('accepts non-blank values', () => {
    expect(validateNonEmpty('value')).toBeUndefined()
  })
})

describe('validateInteger', () => {
  test('rejects non-integers', () => {
    expect(validateInteger('1.5')).toBe('Enter a whole number.')
    expect(validateInteger('abc')).toBe('Enter a whole number.')
  })

  test('accepts integers, including negatives', () => {
    expect(validateInteger('42')).toBeUndefined()
    expect(validateInteger('-7')).toBeUndefined()
  })
})

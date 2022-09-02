import {groupAndMapChoices} from './executor.js'
import {it, describe, expect} from 'vitest'

describe('groupAndMapChoices', () => {
  it('return choices without separator when group information is absent', async () => {
    // Given
    const choice1 = {
      name: 'name1',
      value: 'value1',
    }
    const choice2 = {
      name: 'name2',
      value: 'value2',
    }

    // When
    const result = groupAndMapChoices([choice2, choice1])

    // Then
    expect(result).toHaveLength(2)
    expect((result[0] as {name: string; value: string}).name).toEqual('name2')
    expect((result[1] as {name: string; value: string}).name).toEqual('name1')
  })

  it('return choices with separator when at least one of them has group information', async () => {
    // Given
    const choice1 = {
      name: 'name1',
      value: 'value1',
      group: {
        name: 'group1',
        order: 0,
      },
    }
    const choice2 = {
      name: 'name2',
      value: 'value2',
    }

    // When
    const result = groupAndMapChoices([choice2, choice1])

    // Then
    expect(result).toHaveLength(6)
    expect((result[0] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[1] as {type: 'separator'; line: string}).line).toEqual('group1')
    expect((result[2] as {name: string; value: string}).name).toEqual('name1')
    expect((result[3] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[4] as {type: 'separator'; line: string}).line).toEqual('Other')
    expect((result[5] as {name: string; value: string}).name).toEqual('name2')
  })

  it('return groups ordered by order property with separator when all of them has group information', async () => {
    // Given
    const choice1 = {
      name: 'name1',
      value: 'value1',
      group: {
        name: 'group1',
        order: 1,
      },
    }
    const choice2 = {
      name: 'name2',
      value: 'value2',
      group: {
        name: 'group2',
        order: 0,
      },
    }
    const choice3 = {
      name: 'name3',
      value: 'value3',
      group: {
        name: 'group2',
        order: 0,
      },
    }

    // When
    const result = groupAndMapChoices([choice3, choice1, choice2])

    // Then
    expect(result).toHaveLength(7)
    expect((result[0] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[1] as {type: 'separator'; line: string}).line).toEqual('group2')
    expect((result[2] as {name: string; value: string}).name).toEqual('name3')
    expect((result[3] as {name: string; value: string}).name).toEqual('name2')
    expect((result[4] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[5] as {type: 'separator'; line: string}).line).toEqual('group1')
    expect((result[6] as {name: string; value: string}).name).toEqual('name1')
  })
})

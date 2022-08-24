import {groupAndMapChoices} from './executor.js'
import {it, describe, expect} from 'vitest'

describe('groupAndMapChoices', () => {
  it('return choices ordered by name and without separator when group information is absent', async () => {
    const choice1 = {
      name: 'choice2',
      value: 'value2',
    }
    const choice2 = {
      name: 'choice1',
      value: 'value1',
    }

    const result = groupAndMapChoices([choice1, choice2])
    expect(result).toHaveLength(2)
    expect((result[0] as {name: string; value: string}).name).toEqual('choice1')
    expect((result[1] as {name: string; value: string}).name).toEqual('choice2')
  })

  it('return choices ordered by name and with separator when at least one of them has group information', async () => {
    const choice1 = {
      name: 'choice2',
      value: 'value2',
      group: {
        name: 'group1',
        order: 0,
      },
    }
    const choice2 = {
      name: 'choice1',
      value: 'value1',
    }

    const result = groupAndMapChoices([choice1, choice2])
    expect(result).toHaveLength(6)
    expect((result[0] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[1] as {type: 'separator'; line: string}).line).toEqual('group1')
    expect((result[2] as {name: string; value: string}).name).toEqual('choice2')
    expect((result[3] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[4] as {type: 'separator'; line: string}).line).toEqual('Other')
    expect((result[5] as {name: string; value: string}).name).toEqual('choice1')
  })

  it('return groups and choices ordered by name and wicth separator when all of them has group information', async () => {
    const choice1 = {
      name: 'name2',
      value: 'value2',
      group: {
        name: 'group2',
        order: 1,
      },
    }
    const choice2 = {
      name: 'name3',
      value: 'value3',
      group: {
        name: 'group1',
        order: 0,
      },
    }
    const choice3 = {
      name: 'name1',
      value: 'value1',
      group: {
        name: 'group1',
        order: 0,
      },
    }

    const result = groupAndMapChoices([choice1, choice2, choice3])
    expect(result).toHaveLength(7)
    expect((result[0] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[1] as {type: 'separator'; line: string}).line).toEqual('group1')
    expect((result[2] as {name: string; value: string}).name).toEqual('name1')
    expect((result[3] as {name: string; value: string}).name).toEqual('name3')
    expect((result[4] as {type: 'separator'; line: string}).line).toEqual('')
    expect((result[5] as {type: 'separator'; line: string}).line).toEqual('group2')
    expect((result[6] as {name: string; value: string}).name).toEqual('name2')
  })
})

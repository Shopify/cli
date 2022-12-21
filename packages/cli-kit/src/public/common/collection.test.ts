import {groupBy} from './collection.js'
import {describe, test, expect} from 'vitest'

describe('groupBy', () => {
  test('groups the elements in the array', () => {
    expect(
      groupBy(
        [
          {city: 'Berlin', name: 'User1'},
          {city: 'Berlin', name: 'User2'},
          {city: 'Barcelona', name: 'User3'},
        ],
        'city',
      ),
    ).toEqual({
      Berlin: [
        {city: 'Berlin', name: 'User1'},
        {city: 'Berlin', name: 'User2'},
      ],
      Barcelona: [{city: 'Barcelona', name: 'User3'}],
    })
  })
})

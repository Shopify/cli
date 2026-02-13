import {groupBy, partition} from './collection.js'
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

describe('partition', () => {
  test('creates a partition with the elements in the collection', () => {
    // Given
    const users = [
      {user: 'barney', age: 36, active: false},
      {user: 'fred', age: 40, active: true},
      {user: 'pebbles', age: 1, active: false},
    ]

    // When
    const got = partition(users, (item) => item.active)

    // Then
    expect(got).toEqual([
      [{user: 'fred', age: 40, active: true}],
      [
        {user: 'barney', age: 36, active: false},
        {user: 'pebbles', age: 1, active: false},
      ],
    ])
  })
})

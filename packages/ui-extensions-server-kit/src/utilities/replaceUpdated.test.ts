/* eslint-disable id-length */
import {replaceUpdated} from './replaceUpdated'

describe('replaceUpdated', () => {
  test('replaces updated items in place, and appends new items', () => {
    const arr = [
      {id: 1, a: 'a'},
      {id: 2, a: 'b'},
      {id: 3, a: 'c'},
      {id: 4, a: 'd'},
    ]

    const updates = [
      {id: 2, a: 'updated'},
      {id: 5, a: 'e'},
    ]

    expect(replaceUpdated(arr, updates, ({id}) => id)).toStrictEqual([
      {id: 1, a: 'a'},
      {id: 2, a: 'updated'},
      {id: 3, a: 'c'},
      {id: 4, a: 'd'},
      {id: 5, a: 'e'},
    ])
  })
})

/* eslint-disable id-length */
import {set} from './set'

describe('set()', () => {
  test('deep sets object without mutation', () => {
    const obj = {
      a: {b: {c: {d: '123'}}},
    }

    const newObj = set(obj, (o) => o.a.b.c.d, 'abc')
    expect(newObj).toStrictEqual({
      a: {b: {c: {d: 'abc'}}},
    })

    // verify no mutation occurred
    expect(obj.a.b.c.d).not.toBe('abc')
    expect(obj.a).not.toBe(newObj.a)
  })
})

import {lookupMimeType, setMimeTypes} from './mimes.js'
import {describe, expect, test} from 'vitest'

describe('mimes', () => {
  test('gets mime types for filenames and extensions', async () => {
    const examples = ['file.txt', 'png', '.jpeg', 'file.tar.gz', 'noextension']
    const expected = ['text/plain', 'image/png', 'image/jpeg', 'application/gzip', 'application/octet-stream']
    examples.forEach((example, index) => expect(lookupMimeType(example)).toEqual(expected[index]))
  })

  test('sets mime types for extensions', async () => {
    const newMimeExamples = {
      bar: 'bar/foo',
      foo: 'foo/bar',
    }
    setMimeTypes(newMimeExamples)
    Object.entries(newMimeExamples).forEach(([extension, value]) => expect(lookupMimeType(extension)).toEqual(value))
  })
})

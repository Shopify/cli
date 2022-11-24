import {Link} from './Link.js'
import {renderString} from '../../ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Link', async () => {
  test("renders correctly with a fallback for terminals that don't support hyperlinks", async () => {
    const link = {
      url: 'https://example.com',
      text: 'Example',
    }

    const {output} = renderString(<Link {...link} />)

    expect(output).toMatchInlineSnapshot('"https://example.com [2m(https://example.com)[22m"')
  })
})

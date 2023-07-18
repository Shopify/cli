import {InfoMessage} from './InfoMessage.js'
import {render} from '../../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('InfoMessage', async () => {
  test('renders a message with title and body', async () => {
    const {lastFrame} = render(
      <InfoMessage
        message={{
          title: {
            color: 'red',
            text: "This can't be undone.",
          },
          body: "Once you upgrade this app, you can't go back to the old way of deploying extensions",
        }}
      />,
    )

    expect(lastFrame()).toMatchInlineSnapshot(`
      "[31mThis can't be undone.[39m

      Once you upgrade this app, you can't go back to the old way of deploying extensions"
    `)
  })
})

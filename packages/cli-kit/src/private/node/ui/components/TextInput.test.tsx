import {TextInput} from './TextInput.js'
import {
  sendInputAndWait,
  sendInputAndWaitForChange,
  waitForChange,
  waitForInputsToBeReady,
  render,
} from '../../testing/ui.js'
import React, {useState} from 'react'
import {describe, test, expect, vi} from 'vitest'

const ARROW_LEFT = '\u001B[D'
const ARROW_RIGHT = '\u001B[C'
const DELETE = '\u007F'
const TAB = '\u0009'

describe('TextInput', () => {
  test('default state', () => {
    const {lastFrame} = render(<TextInput value="" onChange={() => {}} />)

    // inverted space escape sequence
    expect(lastFrame()).toMatchInlineSnapshot('"[36m[46m█[49m[39m"')
  })

  test('displays value with cursor', () => {
    const {lastFrame} = render(<TextInput value="Hello" onChange={() => {}} />)

    // inverted space escape sequence after Hello
    expect(lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')
  })

  test('displays placeholder', () => {
    const {lastFrame} = render(<TextInput value="" placeholder="Placeholder" onChange={() => {}} />)

    // inverted escape sequence around "P", laceholder after that
    expect(lastFrame()).toMatchInlineSnapshot('"[36m[7mP[27m[2mlaceholder[22m[39m"')
  })

  test('moves the cursor with arrows', async () => {
    const renderInstance = render(<TextInput value="Hello" onChange={() => {}} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[7mo[27m[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[7ml[27mo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[7ml[27mlo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7me[27mllo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7mH[27mello[39m"')
    // cursor can't go before the first character
    await sendInputAndWait(renderInstance, 100, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7mH[27mello[39m"')

    await sendInputAndWaitForChange(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7me[27mllo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[7ml[27mlo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[7ml[27mo[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[7mo[27m[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')
    // cursor can't go after the last character
    await sendInputAndWait(renderInstance, 100, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')
  })

  test('in noColor mode replaces the current character with █', async () => {
    const renderInstance = render(<TextInput noColor value="Hello" onChange={() => {}} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"Hello█"')

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"Hell█"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"Hel█o"')
  })

  test('moves the cursor when deleting', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('Hello')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[46m█[49m[39m"')
    // cannot delete after the value has been cleared
    await sendInputAndWait(renderInstance, 100, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[46m█[49m[39m"')
  })

  test('accepts input', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'H')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, 'ello')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')
  })

  test('onChange', async () => {
    const onChange = vi.fn()

    const StatefulTextInput = () => {
      const [value, setValue] = useState('')

      return (
        <TextInput
          value={value}
          onChange={(value) => {
            setValue(value)
            onChange(value)
          }}
        />
      )
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'X')

    expect(onChange).toHaveBeenCalledWith('X')
  })

  test('deletes at the beginning and in the middle of text', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'T')
    await sendInputAndWaitForChange(renderInstance, 'e')
    await sendInputAndWaitForChange(renderInstance, 's')
    await sendInputAndWaitForChange(renderInstance, 't')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mTe[7mt[27m[39m"')
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    await sendInputAndWaitForChange(renderInstance, ARROW_LEFT)
    await sendInputAndWait(renderInstance, 100, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7mT[27met[39m"')
  })

  test('adjusts cursor when text is shorter than last value', async () => {
    let resetValue = () => {}

    const StatefulTextInput = () => {
      const [value, setValue] = useState('')
      resetValue = () => setValue('')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'A')
    await sendInputAndWaitForChange(renderInstance, 'B')

    await waitForChange(resetValue, renderInstance.lastFrame)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, 'A')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mA[46m█[49m[39m"')
    await sendInputAndWaitForChange(renderInstance, 'B')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mAB[46m█[49m[39m"')
  })

  test("masking the input if it's a password", async () => {
    const renderInstance = render(<TextInput onChange={() => {}} value="ABC" password />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m***[46m█[49m[39m"')
  })

  test('tab completes with placeholder content', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('')
      const placeholder = 'Hello'

      return <TextInput value={value} onChange={setValue} placeholder={placeholder} />
    }
    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, TAB)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[46m█[49m[39m"')
  })
})

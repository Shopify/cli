import {TextInput} from './TextInput.js'
import {sendInput, waitForChange, waitForInputsToBeReady} from '../../../../testing/ui.js'
import React, {useState} from 'react'
import {describe, test, expect, vi} from 'vitest'
import {render} from 'ink-testing-library'

const ARROW_LEFT = '\u001B[D'
const ARROW_RIGHT = '\u001B[C'
const DELETE = '\u007F'

describe('TextInput', () => {
  test('default state', () => {
    const {lastFrame} = render(<TextInput value="" onChange={() => {}} />)

    // inverted space escape sequence
    expect(lastFrame()).toMatchInlineSnapshot('"[36m[7m [27m[39m"')
  })

  test('displays value with cursor', () => {
    const {lastFrame} = render(<TextInput value="Hello" onChange={() => {}} />)

    // inverted space escape sequence after Hello
    expect(lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')
  })

  test('displays placeholder', () => {
    const {lastFrame} = render(<TextInput value="" placeholder="Placeholder" onChange={() => {}} />)

    // inverted escape sequence around "P", laceholder after that
    expect(lastFrame()).toMatchInlineSnapshot('"[36m[7mP[27m[2mlaceholder[22m[39m"')
  })

  test('moves the cursor with arrows', async () => {
    const renderInstance = render(<TextInput value="Hello" onChange={() => {}} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[7mo[27m[39m"')
    await sendInput(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[7ml[27mo[39m"')
    await sendInput(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[7ml[27mlo[39m"')
    await sendInput(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7me[27mllo[39m"')
    await sendInput(renderInstance, ARROW_LEFT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7mH[27mello[39m"')
    // cursor can't go before the first character
    renderInstance.stdin.write(ARROW_LEFT)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7mH[27mello[39m"')

    await sendInput(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7me[27mllo[39m"')
    await sendInput(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[7ml[27mlo[39m"')
    await sendInput(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[7ml[27mo[39m"')
    await sendInput(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[7mo[27m[39m"')
    await sendInput(renderInstance, ARROW_RIGHT)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')
    // cursor can't go after the last character
    renderInstance.stdin.write(ARROW_RIGHT)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')
  })

  test('moves the cursor when deleting', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('Hello')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')

    await waitForInputsToBeReady()
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHell[7m [27m[39m"')
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHel[7m [27m[39m"')
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHe[7m [27m[39m"')
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7m [27m[39m"')
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7m [27m[39m"')
    // cannot delete after the value has been cleared
    renderInstance.stdin.write(DELETE)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7m [27m[39m"')
  })

  test('accepts input', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'H')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mH[7m [27m[39m"')
    await sendInput(renderInstance, 'ello')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')
  })

  test('onChange', async () => {
    const onChange = vi.fn()

    const renderInstance = render(<TextInput value="" onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'X')

    expect(onChange).toHaveBeenCalledWith('X')
  })

  test('deletes at the beginning and in the middle of text', async () => {
    const StatefulTextInput = () => {
      const [value, setValue] = useState('')

      return <TextInput value={value} onChange={setValue} />
    }

    const renderInstance = render(<StatefulTextInput />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'T')
    await sendInput(renderInstance, 'e')
    await sendInput(renderInstance, 's')
    await sendInput(renderInstance, 't')
    await sendInput(renderInstance, ARROW_LEFT)
    await sendInput(renderInstance, DELETE)
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mTe[7mt[27m[39m"')
    await sendInput(renderInstance, ARROW_LEFT)
    await sendInput(renderInstance, ARROW_LEFT)
    renderInstance.stdin.write(DELETE)
    await new Promise((resolve) => setTimeout(resolve, 100))
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
    await sendInput(renderInstance, 'A')
    await sendInput(renderInstance, 'B')

    await waitForChange(resetValue, renderInstance.lastFrame)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36m[7m [27m[39m"')
    await sendInput(renderInstance, 'A')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mA[7m [27m[39m"')
    await sendInput(renderInstance, 'B')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot('"[36mAB[7m [27m[39m"')
  })
})

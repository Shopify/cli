import {TextInput} from './TextInput.js'
import React from 'react'
import {describe, test, expect} from 'vitest'
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

  test('display value with cursor', (t) => {
    const {lastFrame} = render(<TextInput value="Hello" onChange={() => {}} />)

    // inverted space escape sequence after Hello
    expect(lastFrame()).toMatchInlineSnapshot('"[36mHello[7m [27m[39m"')
  })

  test('display placeholder', (t) => {
    const {lastFrame} = render(<TextInput value="" placeholder="Placeholder" onChange={() => {}} />)

    // inverted escape sequence around "P", laceholder after that
    expect(lastFrame()).toMatchInlineSnapshot('"[36m[7mP[27m[2mlaceholder[22m[39m"')
  })

  // test('moves the cursor with arrows', async () => {})

  // test('moves the cursor when deleting', async () => {})

  // test('accept input (controlled)', async (t) => {
  //   const StatefulTextInput = () => {
  //     const [value, setValue] = useState('')

  //     return <TextInput value={value} onChange={setValue} />
  //   }

  //   const {stdin, lastFrame} = render(<StatefulTextInput />)

  //   t.is(lastFrame(), CURSOR)
  //   await delay(100)
  //   stdin.write('X')
  //   await delay(100)
  //   t.is(lastFrame(), `X${CURSOR}`)
  // })

  // test('onChange', async (t) => {
  //   const onChange = vi.fn()

  //   const {stdin, lastFrame} = render(<TextInput value="" onChange={onChange} />)

  //   t.is(lastFrame(), CURSOR)

  //   await delay(100)
  //   stdin.write('X')
  //   await delay(100)
  //   stdin.write(ENTER)
  //   await delay(100)

  //   t.is(lastFrame(), `X${CURSOR}`)
  //   t.true(onSubmit.calledWith('X'))
  //   t.true(onSubmit.calledOnce)
  // })

  // test('delete at the beginning of text', async (t) => {
  //   const Test = () => {
  //     const [value, setValue] = useState('')

  //     return <TextInput value={value} onChange={setValue} />
  //   }

  //   const {stdin, lastFrame} = render(<Test />)

  //   await delay(100)
  //   stdin.write('T')
  //   await delay(100)
  //   stdin.write('e')
  //   await delay(100)
  //   stdin.write('s')
  //   await delay(100)
  //   stdin.write('t')
  //   stdin.write(ARROW_LEFT)
  //   await delay(100)
  //   stdin.write(ARROW_LEFT)
  //   await delay(100)
  //   stdin.write(ARROW_LEFT)
  //   await delay(100)
  //   stdin.write(ARROW_LEFT)
  //   await delay(100)
  //   stdin.write(DELETE)
  //   await delay(100)

  //   t.is(lastFrame(), `${chalk.inverse('T')}est`)
  // })

  // test('adjust cursor when text is shorter than last value', async (t) => {
  //   let resetValue = () => {}

  //   const Test = () => {
  //     const [value, setValue] = useState('')
  //     resetValue = () => setValue('')

  //     return <TextInput value={value} onChange={setValue} onSubmit={submit} />
  //   }

  //   const {stdin, lastFrame} = render(<Test />)

  //   await delay(100)
  //   stdin.write('A')
  //   await delay(100)
  //   stdin.write('B')
  //   await delay(100)
  //   t.is(lastFrame(), `AB${chalk.inverse(' ')}`)
  //   resetValue()
  //   await delay(100)
  //   t.is(lastFrame(), chalk.inverse(' '))
  //   stdin.write('A')
  //   await delay(100)
  //   t.is(lastFrame(), `A${chalk.inverse(' ')}`)
  //   stdin.write('B')
  //   await delay(100)
  //   t.is(lastFrame(), `AB${chalk.inverse(' ')}`)
  // })

  // test('validation error', async () => {})

  // test('text wrapping', async () => {})
})

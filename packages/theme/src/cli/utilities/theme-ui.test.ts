import {themeComponent, themesComponent, silenceableRenderTasks, SilentWriteStream} from './theme-ui.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'

import {Task} from '@shopify/cli-kit/node/ui'

describe('themeComponent', () => {
  test('returns the ui for a theme', async () => {
    const component = themeComponent(theme(1))

    expect(component).toEqual(["'theme 1'", {subdued: '(#1)'}])
  })
})

describe('themesComponent', () => {
  test('returns the ui for a list of themes', async () => {
    const component = themesComponent([theme(1), theme(2), theme(3)])

    expect(component).toEqual({
      list: {
        items: [
          ["'theme 1'", {subdued: '(#1)'}],
          ["'theme 2'", {subdued: '(#2)'}],
          ["'theme 3'", {subdued: '(#3)'}],
        ],
      },
    })
  })
})
// todo: these tests will pass no matter what
describe('SilentWriteStream', () => {
  test('write method should not output anything', () => {
    const mock = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const silentWriteStream = new SilentWriteStream(1)

    silentWriteStream.write()

    expect(mock).not.toHaveBeenCalled()
  })
})

describe('silenceableRenderTasks', () => {
  test('should not write to process.stdout when silent flag is true', async () => {
    const mock = vi.spyOn(process.stdout, 'write' as any).mockImplementation(() => true)

    const tasks: Task[] = [
      {
        title: 'task 1',
        task: async () => {},
      },
    ]

    await silenceableRenderTasks(tasks, true)

    expect(mock).not.toHaveBeenCalled()
  })
})

function theme(id: number) {
  return {id, name: `theme ${id}`} as Theme
}

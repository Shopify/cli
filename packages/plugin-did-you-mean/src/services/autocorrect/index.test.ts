import {getAutocorrectStatus} from './index.js'
import * as conf from '../conf.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi} from 'vitest'

test('returns the default and persisted preferences without changing configuration or printing output', async () => {
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<conf.ConfigSchema>({cwd: directory})
    const {isAutocorrectEnabled} = conf
    vi.spyOn(conf, 'isAutocorrectEnabled').mockImplementation(() => isAutocorrectEnabled(storage))

    await withCapturedStandardStreams(({stdout, stderr}) => {
      expect(getAutocorrectStatus()).toEqual({enabled: false})
      expect(storage.get('autocorrectEnabled')).toBeUndefined()

      for (const enabled of [true, false]) {
        storage.set('autocorrectEnabled', enabled)
        expect(getAutocorrectStatus()).toEqual({enabled})
        const reloadedStorage = new LocalStorage<conf.ConfigSchema>({cwd: directory})
        expect(reloadedStorage.get('autocorrectEnabled')).toBe(enabled)
      }

      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })
  })
})

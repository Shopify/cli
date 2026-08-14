import {prepareGlobalAuth} from './global-auth.js'
import {TEST_TIMEOUT} from './constants.js'
import {test as setup} from '@playwright/test'

setup('authenticate', async () => {
  setup.setTimeout(TEST_TIMEOUT.long)
  await prepareGlobalAuth()
})

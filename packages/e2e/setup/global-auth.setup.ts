import {prepareGlobalAuth} from './global-auth.js'
import {test as setup} from '@playwright/test'

setup('authenticate', async () => {
  await prepareGlobalAuth()
})

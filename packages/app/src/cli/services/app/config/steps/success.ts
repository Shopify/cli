import {createStep} from '../utils/utils.js'

export default createStep('success', success)

// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function success(options: any) {
  console.log('success!')
}

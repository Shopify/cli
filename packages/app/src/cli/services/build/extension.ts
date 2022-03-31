import {Writable} from 'node:stream'
import {Extension} from '$cli/models/app/app'

interface HomeOptions {
  stdout: Writable
}

export default async function extension(extension: Extension, {stdout}: HomeOptions): Promise<void> {
  stdout.write('Building')
  return new Promise((resolve, reject) => setInterval(resolve, 5 * 1000))
}

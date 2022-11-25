import {Signal} from '../../abort.js'
import {renderConcurrent} from '../../public/node/ui.js'
import {Abort} from '../../error.js'
import {Writable} from 'form-data'

const throwingProcess = {
  prefix: 'backend',
  action: async (_stdout: Writable, _stderr: Writable, _signal: Signal) => {
    throw new Abort('error')
  },
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
renderConcurrent({processes: [throwingProcess]})

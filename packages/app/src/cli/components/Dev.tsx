import ConcurrentOutput from './ConcurrentOutput.js'
import React from 'react'
import {OutputProcess} from '@shopify/cli-kit/src/output.js'

export function Dev({processes}: {processes: OutputProcess[]}) {
  return <ConcurrentOutput processes={processes} />
}

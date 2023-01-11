import {totalmem, cpus, arch} from 'node:os'

export function osMetadata() {
  const metadata = {}
  metadata.memory = totalmem()
  metadata.arch = arch()
  metadata.cpus = cpus()
  return metadata
}

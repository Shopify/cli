import {reportEvent} from '../services/monorail'

// This hook is called manually from the code. More info: https://oclif.io/docs/hooks#custom-events
export const monorail = async (options: {id: string}) => {
  const command = options.id.split(' ').pop() || ''
  const commandIndex = process.argv.indexOf(command)
  const args = process.argv.slice(commandIndex + 1)
  await reportEvent(options.id, args)
}

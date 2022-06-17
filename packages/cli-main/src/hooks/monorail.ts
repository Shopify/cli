import {monorail} from '@shopify/cli-kit'

// This hook is called manually from the code. More info: https://oclif.io/docs/hooks#custom-events
export const hook = async (options: {id: string}) => {
  const command = options.id.split(' ').pop() || ''
  const commandIndex = process.argv.indexOf(command)
  const args = process.argv.slice(commandIndex + 1)
  await monorail.reportEvent(options.id, args)
}

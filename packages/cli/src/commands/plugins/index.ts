import {commands} from '@oclif/plugin-plugins'
const cmd = commands.plugins
cmd.hidden = true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default cmd as any

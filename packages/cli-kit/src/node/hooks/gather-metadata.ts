/* eslint-disable @typescript-eslint/naming-convention */
import {JsonMap} from '../../json.js'
import {Hook, Interfaces} from '@oclif/core'

interface MetadataHooks extends Interfaces.Hooks {
  public_command_metadata: {
    // eslint-disable-next-line @typescript-eslint/ban-types
    options: {}
    return: JsonMap
  }
  sensitive_command_metadata: {
    // eslint-disable-next-line @typescript-eslint/ban-types
    options: {}
    return: JsonMap
  }
}

export type PublicCommandMetadataHook = Hook<'public_command_metadata', MetadataHooks>
export type SensitiveCommandMetadataHook = Hook<'sensitive_command_metadata', MetadataHooks>

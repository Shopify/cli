import Build from './commands/app/build.js'
import ConfigLink from './commands/app/config/link.js'
import ConfigUse from './commands/app/config/use.js'
import Deploy from './commands/app/deploy.js'
import Dev from './commands/app/dev.js'
import DraftExtensionsPush from './commands/app/draft-extensions/push.js'
import EnvPull from './commands/app/env/pull.js'
import EnvShow from './commands/app/env/show.js'
import FunctionBuild from './commands/app/function/build.js'
import FunctionReplay from './commands/app/function/replay.js'
import FunctionRun from './commands/app/function/run.js'
import FetchSchema from './commands/app/function/schema.js'
import FunctionTypegen from './commands/app/function/typegen.js'
import AppGenerateExtension from './commands/app/generate/extension.js'
import GenerateSchema from './commands/app/generate/schema.js'
import ImportExtensions from './commands/app/import-extensions.js'
import AppInfo from './commands/app/info.js'
import Init from './commands/app/init.js'
import Release from './commands/app/release.js'
import VersionsList from './commands/app/versions/list.js'
import WebhookTrigger from './commands/app/webhook/trigger.js'
import WebhookTriggerDeprecated from './commands/webhook/trigger.js'
import init from './hooks/clear_command_cache.js'
import gatherPublicMetadata from './hooks/public_metadata.js'
import gatherSensitiveMetadata from './hooks/sensitive_metadata.js'

export const commands = {
  'app:build': Build,
  'app:deploy': Deploy,
  'app:dev': Dev,
  'app:import-extensions': ImportExtensions,
  'app:info': AppInfo,
  'app:init': Init,
  'app:release': Release,
  'app:config:link': ConfigLink,
  'app:config:use': ConfigUse,
  'app:draft-extensions:push': DraftExtensionsPush,
  'app:env:pull': EnvPull,
  'app:env:show': EnvShow,
  'app:generate:schema': GenerateSchema,
  'app:function:build': FunctionBuild,
  'app:function:replay': FunctionReplay,
  'app:function:run': FunctionRun,
  'app:function:schema': FetchSchema,
  'app:function:typegen': FunctionTypegen,
  'app:generate:extension': AppGenerateExtension,
  'app:versions:list': VersionsList,
  'app:webhook:trigger': WebhookTrigger,
  'webhook:trigger': WebhookTriggerDeprecated,
}

export const AppSensitiveMetadataHook = gatherSensitiveMetadata
export const AppInitHook = init
export const AppPublicMetadataHook = gatherPublicMetadata

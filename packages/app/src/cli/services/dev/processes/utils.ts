import {Web, WebType} from '../../../models/app/app.js'
import {isWebType} from '../../../models/app/loader.js'

export function frontAndBackendConfig(webs: Web[]) {
  const frontendConfig = webs.find((web) => isWebType(web, WebType.Frontend))
  const backendConfig = webs.find((web) => isWebType(web, WebType.Backend))
  return {frontendConfig, backendConfig}
}

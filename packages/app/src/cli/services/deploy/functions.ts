import {api, error, path, session} from '@shopify/cli-kit'
import {readFileSync} from 'fs'
import {App, FunctionExtension} from '$cli/models/app/app'

export async function deployFunction(extension: FunctionExtension, app: App) {
  const {url, headers} = await getUploadURL(app)
  headers['Content-Type'] = 'application/wasm'

  // MISSING: build
  const builtFunctionPath = path.join(extension.directory, 'build/index.wasm')

  const functionContent = readFileSync(builtFunctionPath, 'binary')

  const res = await fetch(url, {body: functionContent, headers, method: 'PUT'})
  if (res.status !== 200) {
    throw new error.Abort('Unkown error deploying script')
  }

  return url
}

async function getUploadURL(app: App): Promise<{url: string; headers: any}> {
  const token = await session.ensureAuthenticatedPartners()
  const query = api.graphql.ModuleUploadUrlGenerateMutation
  const res: api.graphql.ModuleUploadUrlGenerateMutationSchema = await api.partners.functionProxyRequest(
    app.configuration.id!,
    query,
    token,
  )
  return res.data.moduleUploadUrlGenerate.details
}

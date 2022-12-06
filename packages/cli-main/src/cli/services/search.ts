import {http, abort} from '@shopify/cli-kit'
import {renderInteractiveList} from '@shopify/cli-kit/node/ui'

export async function searchService(query: string) {
  // await search(query)

  renderInteractiveList({question: 'What are you searching for?', fetch: search})
}

async function search(query: string, signal: abort.Signal) {
  const searchParams = new URLSearchParams()
  searchParams.append('query', query)
  searchParams.append('page', '1')
  //   searchParams.append('version', '2022-10')
  try {
    const res = await http.fetch(`https://shopify.dev/search/autocomplete?${searchParams.toString()}`, {signal})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonResponse: any = await res.json()
    return jsonResponse.results
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    return []
    // eslint-disable-next-line no-warning-comments
    // TODO: handle errors + when the request is terminated
  }

  // .slice(0, 3).forEach((result: any) => {
  //   output.info(output.content`${output.token.heading(`${result.title}`)}`)
  //   output.info(output.content`${output.token.genericShellCommand(`${result.breadcrumb}`)}`)
  //   output.info(result.description)
  //   output.info(output.content`${output.token.link('Link', `https://shopify.dev${result.url}`)}`)
  //   output.newline()
  // })
}
// {
//     "query": "cli",
//     "page": 1,
//     "num_pages": 16,
//     "total": 785,
//     "results": [
//       {
//         "url": "/themes/tools/cli/install",
//         "breadcrumb": "themes / tools / cli / install",
//         "title": "Install Shopify CLI",
//         "description": "learn how to install shopify **cli** on macos, windows, or linux.",
//         "section": null,
//         "content_category": "Themes",
//         "snippet": "Shopify **CLI** is managed as a set of Node.js packages:\n\n- [@shopify/**cli**](https://www.npmjs.com/package/@shopify/**cli**)\n- [@shopify",
//         "version": null,
//         "parent_name": null,
//         "type": null,
//         "gid": "D3D1CDA1-2DAD-4EA0-A3B1-A6E9B0C51548",
//         "is_api_ref": null
//       },
//     ]
// }

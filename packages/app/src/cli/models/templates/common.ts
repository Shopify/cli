import {ExtensionFlavor} from '../app/extensions.js'

export function uiFlavors(path: string): ExtensionFlavor[] {
  return [
    {
      name: 'TypeScript',
      value: 'typescript',
      path,
    },
    {
      name: 'JavaScript',
      value: 'vanilla-js',
      path,
    },
    {
      name: 'TypeScript React',
      value: 'typescript-react',
      path,
    },
    {
      name: 'JavaScript React',
      value: 'react',
      path,
    },
  ]
}

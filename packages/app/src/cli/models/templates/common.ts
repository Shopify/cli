import {ExtensionFlavor} from '../app/template.js'

export function uiFlavors(path: string): ExtensionFlavor[] {
  return [
    {
      name: 'JavaScript React',
      value: 'react',
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
      name: 'TypeScript',
      value: 'typescript',
      path,
    },
  ]
}

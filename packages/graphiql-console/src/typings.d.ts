// CSS Modules - named exports pattern
declare module '*.module.scss' {
  const classes: {[key: string]: string}
  export = classes
}

declare module '*.scss' {
  const content: string
  export default content
}

declare module '*.module.css' {
  const classes: {[key: string]: string}
  export = classes
}

// Vite worker imports
declare module '*?worker' {
  const workerConstructor: new () => Worker
  export default workerConstructor
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_GRAPHIQL_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

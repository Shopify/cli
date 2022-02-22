import {Liquid} from 'liquidjs'

// This line is necessary to register additional helpers.
export function template(templateContent: string) {
  return (data: object): Promise<string> => {
    const engine = new Liquid()
    return engine.render(engine.parse(templateContent), data)
  }
}

export interface JsonMap {
  [key: string]: AnyJson
}
type JsonArray = boolean[] | number[] | string[] | JsonMap[] | Date[]
export type AnyJson = boolean | number | string | JsonMap | Date | JsonArray | JsonArray[]

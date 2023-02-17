export interface JsonMap {
  [key: string]: AnyJson
}
type JsonArray = undefined[] | null[] | boolean[] | number[] | string[] | JsonMap[] | Date[]
export type AnyJson = undefined | null | boolean | number | string | JsonMap | Date | JsonArray | JsonArray[]

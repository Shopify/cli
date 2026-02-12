type Scalar = string | number | boolean | null | undefined

export default interface ScalarDict {
  [key: string]: Scalar
}

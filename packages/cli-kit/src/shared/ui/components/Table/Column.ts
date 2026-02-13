export interface Column<T> {
  name: keyof T
  width: number
  color?: string
}

import Config from 'conf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Conf<T extends {[key: string]: any}> {
  private readonly config: Config<T>

  constructor(options: {projectName: string}) {
    this.config = new Config<T>(options)
  }

  get<TKey extends keyof T>(key: TKey): T[TKey] {
    return this.config.get(key)
  }

  set<TKey extends keyof T>(key: TKey, value?: T[TKey]): void {
    this.config.set(key, value)
  }

  delete<TKey extends keyof T>(key: TKey): void {
    this.config.delete(key)
  }

  reset<TKey extends keyof T>(key: TKey): void {
    this.config.reset(key)
  }

  clear(): void {
    this.config.clear()
  }
}

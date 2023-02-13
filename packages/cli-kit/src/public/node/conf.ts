import Config from 'conf'

export class Conf<T extends {[key: string]: unknown}> {
  private readonly config: Config<T>

  constructor(options: {projectName: string}) {
    this.config = new Config<T>(options)
  }

  get<TKey extends keyof T>(key: TKey): T[TKey] | undefined {
    return this.config.get(key)
  }

  set<TKey extends keyof T>(key: TKey, value?: T[TKey]): void {
    this.config.set(key, value)
  }

  delete<TKey extends keyof T>(key: TKey): void {
    this.config.delete(key)
  }

  clear(): void {
    this.config.clear()
  }
}

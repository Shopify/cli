export class Theme {
  constructor(
    public id: number,
    public name: string,
    public createdAt: string,
    public updatedAt: string,
    private _role: string,
    public themeStoreId: number | null,
    public previewable: boolean,
    public processing: boolean,
    public adminGraphqlApiId: string,
  ) {}

  get role(): string {
    if (this._role === 'main') {
      return 'live'
    } else {
      return this._role
    }
  }

  set role(_role: string) {
    if (_role === 'live') {
      this._role = 'main'
    } else {
      this._role = _role
    }
  }
}

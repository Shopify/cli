export class Theme {
  constructor(
    public id: number,
    public name: string,
    public createdAt: string,
    public updatedAt: string,
    public role: 'live' | 'unpublished' | 'development',
    public themeStoreId: number | null,
    public previewable: boolean,
    public processing: boolean,
    public adminGraphqlApiId: string,
  ) {}
}

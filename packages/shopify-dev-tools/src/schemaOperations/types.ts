export interface OfflineScopeEntry {
  type: "type" | "field";
  typeName: string;
  fieldName?: string;
  returnType?: string;
  kind?: string;
  requiredAccess: string;
  offlineScopes: string[];
}

export interface OfflineScopeData {
  items: OfflineScopeEntry[];
}

export interface UploadUrlGenerateMutationSchema {
  uploadUrlGenerate: {
    url: string
    moduleId: string
    headers: {[key: string]: string}
    maxSize: string
  }
}

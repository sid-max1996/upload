export default interface IUploadeParams {
  url: string; // file url to upload
  uploadDir?: string; // change uploaded file dir
  fileName?: string; // change uploaded file name
  filePath?: string; // change uploaded file path
  continueUploading?: boolean; // change continue downloading from where it stopped
  headers?: Record<string, string>;
}

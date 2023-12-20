import { Agent } from 'http';

export default interface IUploaderParams {
  byteLimit?: number | null; // bytes per second limit for download
  uploadDir?: string | null; // path to the folder where files are uploaded
  proxyAgent?: Agent | null; // to use proxy
  continueUploading?: boolean; // continue downloading from where it stopped
  headers?: Record<string, string>;
  timeoutMs?: number;
}

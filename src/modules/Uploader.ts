import * as path from 'path';
import * as EventEmitter from 'events';
import IUploaderParams from '../interfaces/IUploaderParams';
import IUploadeParams from '../interfaces/IUploadParams';
import File from './File';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { URL } from 'url';
import AbortError from '../errors/AbortError';
import HttpError from '../errors/HttpError';
import Progress from './Progress';
import Speed from './Speed';

export default class Uploader {
  private uploadDir: string | null = null;
  private proxyAgent: http.Agent | null = null;
  private continueUploading: boolean = false;
  private extraHeaders: Record<string, string> = {};

  private request: http.ClientRequest | null = null;
  private stream: fs.WriteStream | null = null;

  private uploadedSize: number = 0;

  private progress: Progress;
  private speed: Speed;

  private _emitter = new EventEmitter();

  public get emitter(): EventEmitter {
    return this._emitter;
  }

  constructor(params: IUploaderParams) {
    this.progress = new Progress(this.emitter);
    this.speed = new Speed(params?.byteLimit ?? null, this.emitter);
    this.changeParams(params);
  }

  public changeParams(params: IUploaderParams) {
    if (!params) return;
    if (params.byteLimit !== undefined) {
      this.speed.byteLimit = params.byteLimit;
      this.emitter.emit('log', `Changed param byteLimit on ${this.speed.byteLimit}`);
    }
    if (params.uploadDir !== undefined) {
      this.uploadDir = params.uploadDir;
      this.emitter.emit('log', `Changed param uploadDir on ${this.uploadDir}`);
    }
    if (params.proxyAgent !== undefined) {
      this.proxyAgent = params.proxyAgent;
      this.emitter.emit('log', `Changed param proxyAgent on ${this.proxyAgent}`);
    }
    if (params.continueUploading !== undefined) {
      this.continueUploading = params.continueUploading;
      this.emitter.emit('log', `Changed param continueUploading on ${this.continueUploading}`);
    }
    if (params.headers !== undefined) {
      this.extraHeaders = params.headers;
      this.emitter.emit('log', `Changed param headers on ${this.extraHeaders}`);
    }
  }

  private parseUrl(url: string): URL {
    return new URL(url);
  }

  private getFileName(parsedUrl: URL) {
    return parsedUrl.pathname.split('/').pop();
  }

  public destroy(err?: Error) {
    this.speed.stop();
    this.progress.stop();
    if (this.stream) {
      this.emitter.emit('debug', `Destroy stream.`);
      this.stream.destroy(err);
      this.stream = null;
    }
    if (this.request) {
      this.emitter.emit('debug', `Destroy request.`);
      this.request.destroy(err);
      this.request = null;
    }
  }

  private headers(parsedUrl: URL, extraHeaders: Record<string, string>): Promise<http.IncomingHttpHeaders> {
    return new Promise((resolve, reject) => {
      const protocol = parsedUrl.protocol.startsWith('https') ? https : http;
      this.emitter.emit('debug', `HEAD request (headers: ${JSON.stringify(extraHeaders, null, 2)}).`);
      this.request = protocol
        .request(
          parsedUrl,
          {
            method: 'HEAD',
            agent: this.proxyAgent ?? undefined,
            headers: extraHeaders,
          },
          (res: http.IncomingMessage) => {
            this.request = null;
            resolve(res.headers);
          },
        )
        .on('error', (err: Error) => reject(err))
        .end();
    });
  }

  private download(filePath: string, parsedUrl: URL, extraHeaders: Record<string, string>): Promise<void | string> {
    // continue downloading from where it stopped
    const headers = { ...extraHeaders };
    if (this.uploadedSize) {
      headers.Range = `bytes=${this.uploadedSize}-`;
    }
    this.emitter.emit('debug', `GET request (headers: ${JSON.stringify(headers, null, 2)}).`);
    return new Promise((resolve, reject) => {
      const protocol = parsedUrl.protocol.startsWith('https') ? https : http;
      this.request = protocol
        .get(
          parsedUrl,
          {
            agent: this.proxyAgent ?? undefined,
            headers,
          },
          (res: http.IncomingMessage) => {
            if (res.statusCode === 303) {
              resolve(res.headers.location);
              return;
            }
            if (res.statusCode !== 200 && res.statusCode !== 206) {
              reject(new HttpError(res.statusCode, `Http error ${res.statusCode}`));
              return;
            }
            const contentLength = Number(res.headers['content-length']);
            this.emitter.emit('debug', `Download (contentLength: ${contentLength}).`);
            this.stream = fs.createWriteStream(filePath, { flags: 'a' });
            if (!this.stream) {
              reject(new Error(`File stream not exists ${filePath}`));
              return;
            }
            this.emitter.emit('debug', `Download create stream.`);
            this.progress.start(contentLength, this.uploadedSize, this.request);

            this.speed.start(res);
            res.on('data', (chunk) => {
              try {
                this.emitter.emit('debug', `Chunk: (len: ${chunk.length}).`);
                if (!this.stream) {
                  throw new Error(`File stream not exists ${filePath}`);
                }
                this.stream.write(chunk);
                this.speed.check(this.request?.socket?.bytesRead ?? null);
              } catch (err) {
                reject(err);
              }
            });

            res.on('end', () => {
              this.speed.stop();
              this.progress.stop();
              if (!this.stream) {
                reject(new Error(`File stream not exists ${filePath}`));
              } else {
                this.stream.end(() => {
                  resolve();
                });
              }
            });

            res.on('error', (err: Error) => {
              reject(err);
            });
          },
        )
        .on('error', (err: Error) => {
          reject(err);
        });
    });
  }

  /**
   * @param  {IUploadeParams} params
   * @returns Promise<string> - uploaded file path
   */
  public async upload(params: IUploadeParams): Promise<string> {
    try {
      this.destroy(new AbortError('Abort error'));
      const parsedUrl = this.parseUrl(params.url);
      const extraHeaders = params.headers || this.extraHeaders;
      let filePath = params.filePath;
      if (!filePath) {
        const uploadDir = params.uploadDir || this.uploadDir;
        if (!uploadDir) {
          throw new Error('uploadDir not specified');
        }
        const fileName = params.fileName ?? this.getFileName(parsedUrl);
        if (!fileName) {
          throw new Error('fileName not specified');
        }
        filePath = path.join(uploadDir, fileName);
      }
      this.emitter.emit('log', `Start upload (url: ${params.url}, filePath: ${filePath}).`);
      const stats = await File.stats(filePath);
      const continueUploading = params.continueUploading || this.continueUploading;
      if (!continueUploading && stats !== null) {
        // remove file before uploading
        await File.remove(filePath);
        this.emitter.emit('log', `File removed before uploading (path: ${filePath}).`);
      }
      this.uploadedSize = 0;
      if (continueUploading && stats !== null) {
        // continue downloading from where it stopped
        this.uploadedSize = stats.size;
        const headers = await this.headers(parsedUrl, extraHeaders);
        const contentLength = Number(headers['content-length']);
        if (isNaN(contentLength) || contentLength <= 0 || this.uploadedSize >= contentLength) {
          this.emitter.emit(
            'log',
            `Continie uploading bad values (contentLength: ${contentLength}, uploadedSize: ${this.uploadedSize}).`,
          );
          this.uploadedSize = 0;
          await File.remove(filePath);
          this.emitter.emit('log', `File removed before uploading (path: ${filePath}).`);
        } else {
          this.emitter.emit('log', `Continie uploading (size: ${this.uploadedSize}).`);
        }
      }
      const redirectUrl = await this.download(filePath, parsedUrl, extraHeaders);
      if (redirectUrl) {
        this.emitter.emit('debug', `Redirect ` + redirectUrl);
        const redirectParsedUrl = this.parseUrl(redirectUrl);
        await this.download(filePath, redirectParsedUrl, extraHeaders);
      }
      return filePath;
    } catch (err) {
      throw err;
    } finally {
      this.destroy();
    }
  }
}

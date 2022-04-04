import * as http from 'http';
import * as EventEmitter from 'events';

export default class Progress {
  private readonly delay = 1000;

  private emitter: EventEmitter;
  private timer: any;
  private running: boolean = false;

  private contentLength: number = 0;
  private uploadedSize: number = 0;
  private request: http.ClientRequest | null = null;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  private check() {
    if (this.running && this.request?.socket) {
      const readBytes = this.request.socket.bytesRead + this.uploadedSize;
      const onePercent = (this.contentLength + this.uploadedSize) / 100;
      const percent = Math.round(readBytes / onePercent);
      if (percent >= 0 && percent < 100) {
        this.emitter.emit('progress', percent);
        this.timer = setTimeout(this.check.bind(this), this.delay);
      } else if (percent >= 100) {
        this.emitter.emit('progress', 100);
      }
    }
  }

  public start(contentLength: number, uploadedSize: number, request: http.ClientRequest | null) {
    this.contentLength = contentLength;
    this.uploadedSize = uploadedSize;
    this.request = request;
    
    clearTimeout(this.timer);
    this.emitter.emit('progress', 0);
    this.running = true;
    this.timer = setTimeout(this.check.bind(this), this.delay);
  }

  public stop() {
    this.check();
    this.running = false;
    this.request = null;
    clearTimeout(this.timer);
  }
}

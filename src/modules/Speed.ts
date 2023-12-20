import * as http from 'http';
import * as EventEmitter from 'events';

export default class Spead {
  private timer: any = null;

  public byteLimit: number | null = null;
  private emitter: EventEmitter;

  private prevBytes: number = 0;
  private bytesPerSec: number = 0;
  private response: http.IncomingMessage | null = null;

  constructor(byteLimit: number | null, emitter: EventEmitter) {
    this.byteLimit = byteLimit;
    this.emitter = emitter;
  }

  public check(curBytes: number | null) {
    if (this.byteLimit !== null && curBytes !== null) {
      const diffBytes = curBytes - this.prevBytes;
      this.bytesPerSec += diffBytes;
      this.prevBytes = curBytes;

      if (this.bytesPerSec >= this.byteLimit) {
        this.response?.pause();
        this.emitter.emit('log', `Speed limit pause (bytesPerSec: ${this.bytesPerSec}, byteLimit: ${this.byteLimit}).`);
      }
      clearTimeout(this.timer);
      this.timer = setTimeout(this.clear.bind(this), 1000);
    }
  }

  private clear() {
    this.bytesPerSec = 0;
    if (this.response?.isPaused()) {
      this.response?.resume();
      this.emitter.emit('log', `Speed limit resume.`);
    }
    this.timer = null;
  }

  public start(response: http.IncomingMessage) {
    this.prevBytes = 0;
    this.bytesPerSec = 0;
    this.response = response;
  }

  public stop() {
    clearTimeout(this.timer);
    this.response = null;
  }
}

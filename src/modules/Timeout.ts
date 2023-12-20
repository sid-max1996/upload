export default class Timeout {
  private _timerId: any = null;
  private _onTimeout: (() => void) | null = null;
  private _time: number | null = null;

  prevent() {
    clearTimeout(this._timerId);
    if (!this._time) {
      throw new Error('Download file request timeout bad time');
    }
    this._timerId = setTimeout(() => {
      if (!this._onTimeout) {
        throw new Error('Download file request timeout bad onTimeout');
      }
      this._onTimeout();
    }, this._time);
  }

  start(onTimeout: () => void, time: number) {
    this._onTimeout = onTimeout;
    this._time = time;
    this.prevent();
  }

  stop() {
    clearTimeout(this._timerId);
    this._onTimeout = null;
    this._time = null;
  }
}

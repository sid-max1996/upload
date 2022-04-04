export default class AbortError extends Error {
  constructor(msg: string) {
      super(msg);
      Object.setPrototypeOf(this, AbortError.prototype);
  }
}

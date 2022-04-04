export default class HttpError extends Error {
  private code: number | undefined;

  public get statusCode() {
    return this.code;
  }

  constructor(code: number | undefined, msg: string) {
      super(msg);
      this.code = code;
      Object.setPrototypeOf(this, HttpError.prototype);
  }
}

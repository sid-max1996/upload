export class AbortError extends Error {
  constructor(msg: string) {
      super(msg);
      Object.setPrototypeOf(this, AbortError.prototype);
  }
}

export class HttpError extends Error {
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

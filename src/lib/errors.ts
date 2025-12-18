export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly fileName?: string
  ) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

export class DetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetectionError';
  }
}

export class UnsupportedFormatError extends Error {
  constructor(
    message: string,
    public readonly format?: string
  ) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

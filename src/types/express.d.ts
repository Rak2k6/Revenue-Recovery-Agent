// Extend Express Request to include rawBody captured before JSON parsing
declare namespace Express {
  interface Request {
    rawBody?: Buffer;
  }
}

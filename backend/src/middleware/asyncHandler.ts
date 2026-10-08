import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Forwards rejected promises to the Express error middleware (Express 4 does not do it). */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

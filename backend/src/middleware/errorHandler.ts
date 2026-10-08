import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../errors/HttpError";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

const send = (
  res: Parameters<ErrorRequestHandler>[2],
  status: number,
  code: string,
  message: string,
  details?: unknown,
) => {
  const body: ErrorBody = { error: { code, message, details } };
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  send(res, 404, "ROUTE_NOT_FOUND", "La ruta solicitada no existe.");
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return send(res, 400, "VALIDATION_ERROR", "Los datos enviados no son válidos.", details);
  }

  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return send(res, 413, "FILE_TOO_LARGE", "El archivo supera el tamaño máximo permitido.");
      case "LIMIT_FILE_COUNT":
      case "LIMIT_UNEXPECTED_FILE":
        return send(res, 400, "TOO_MANY_FILES", "Se enviaron demasiados archivos o un campo inesperado.");
      default:
        return send(res, 400, "UPLOAD_ERROR", "No se pudo procesar la subida del archivo.");
    }
  }

  if ((err as { type?: string }).type === "entity.parse.failed") {
    return send(res, 400, "INVALID_JSON", "El cuerpo de la petición no es un JSON válido.");
  }

  console.error("[unhandled error]", err);
  return send(res, 500, "INTERNAL_ERROR", "Ocurrió un error inesperado en el servidor.");
};

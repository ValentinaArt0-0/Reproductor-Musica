export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado.";

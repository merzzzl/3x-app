import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { errorDetails } from './diagnostics.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Проверьте введённые данные.', fields: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Do not log request bodies, upstream responses or VPN credentials.
  console.error('Request failed:', errorDetails(error));
  res.status(500).json({ error: 'Не удалось выполнить запрос. Попробуйте ещё раз.' });
};

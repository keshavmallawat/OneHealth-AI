/** One response envelope for the whole API: { success, data, message }. */
import { Response } from 'express';
import { ZodError } from 'zod';

export function ok(res: Response, data: any, message?: string, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function fail(res: Response, status: number, message: string, data: any = null) {
  // `error` is duplicated for backwards compatibility with the original
  // controllers, which the frontend error formatter still understands.
  return res.status(status).json({ success: false, data, message, error: message });
}

/** First human-readable problem out of a zod failure. */
export function zodMessage(error: ZodError, fallback = 'Some of the values you entered are not valid.'): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}

/** Wraps a controller so an unexpected throw becomes a clean 500, never a stack trace. */
export function guard(
  handler: (req: any, res: Response) => Promise<any>,
  message = 'Something went wrong. Please try again.'
) {
  return async (req: any, res: Response) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error('[api]', message, error?.message || error);
      if (!res.headersSent) fail(res, 500, message);
    }
  };
}

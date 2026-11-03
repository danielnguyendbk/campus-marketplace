import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiErrorDetail,
  ApiErrorPayload,
  ErrorEnvelope,
} from '../interfaces/api-response.interface';

/**
 * Sanitizes log messages by masking passwords, database credentials, secret keys, and auth tokens.
 */
export function sanitizeLogMessage(input: string): string {
  if (!input) return '';
  return input
    // Mask PostgreSQL / database URLs credentials: protocol://user:password@host
    .replace(/((?:postgres|postgresql|mysql|mongodb):\/\/[^:]+:)([^@\s]+)(@)/gi, '$1****$3')
    // Mask password in query parameters: ?password=secret or &password=secret
    .replace(/([?&](?:password|passwd|pwd|secret)=)[^&\s]+/gi, '$1****')
    // Mask common sensitive key-values: password="xyz", "secret": "xyz", token: xyz
    .replace(
      /(["']?(?:password|passwd|pwd|secret|api_?key|token|authorization)["']?\s*[:=]\s*["']?)([^"',\s&]+)(["']?)/gi,
      '$1****$3',
    )
    // Mask Bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1****');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let resolvedMessage: string;
    let errorCode: string;
    let details: ApiErrorDetail[] | undefined = undefined;

    const isHttpException = exception instanceof HttpException;
    const rawStatus = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // All errors with HTTP status 500 (including InternalServerErrorException and non-HttpExceptions)
    // must strictly return safe generic messages and hide all internal diagnostics.
    if (isHttpException && rawStatus !== HttpStatus.INTERNAL_SERVER_ERROR) {
      status = rawStatus;
      const exceptionResponse = exception.getResponse();

      resolvedMessage = 'Request failed';
      errorCode = 'REQUEST_FAILED';

      if (typeof exceptionResponse === 'string') {
        resolvedMessage = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const respObj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(respObj.message)) {
          details = respObj.message.map((msg: unknown) => ({
            message: String(msg),
          }));
          resolvedMessage = (respObj.message as string[]).join(', ');
          errorCode = 'VALIDATION_FAILED';
        } else if (typeof respObj.message === 'string') {
          resolvedMessage = respObj.message;
        }

        if (typeof respObj.code === 'string') {
          errorCode = respObj.code;
        } else if (typeof respObj.error === 'string' && errorCode !== 'VALIDATION_FAILED') {
          errorCode = respObj.error.toUpperCase().replace(/\s+/g, '_');
        }

        if (Array.isArray(respObj.details)) {
          details = respObj.details as ApiErrorDetail[];
        }
      }

      // Default fallback mapping based on HTTP status code if code is generic
      if (errorCode === 'REQUEST_FAILED' || errorCode === 'ERROR') {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            errorCode = 'BAD_REQUEST';
            break;
          case HttpStatus.UNAUTHORIZED:
            errorCode = 'UNAUTHORIZED';
            break;
          case HttpStatus.FORBIDDEN:
            errorCode = 'FORBIDDEN';
            break;
          case HttpStatus.NOT_FOUND:
            errorCode = 'NOT_FOUND';
            break;
          case HttpStatus.CONFLICT:
            errorCode = 'CONFLICT';
            break;
          case HttpStatus.UNPROCESSABLE_ENTITY:
            errorCode = 'UNPROCESSABLE_ENTITY';
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            errorCode = 'TOO_MANY_REQUESTS';
            break;
          default:
            errorCode = 'HTTP_ERROR';
            break;
        }
      }

      const rawLog = `[${request.method}] ${request.url} Status: ${status} [${errorCode}] - ${resolvedMessage}`;
      this.logger.warn(sanitizeLogMessage(rawLog));
    } else {
      // ALL HTTP 500 ERRORS (InternalServerErrorException, non-HttpExceptions, PostgreSQL errors, runtime crashes)
      // SECURITY DIRECTIVE:
      // 1. HTTP Status MUST be 500.
      // 2. error.code MUST be "INTERNAL_SERVER_ERROR".
      // 3. error.message MUST be "Internal server error".
      // 4. error.details MUST be undefined.
      // 5. Never expose stack traces, database credentials, SQL queries, or internal details in response.
      // 6. Server logs record error details with secrets sanitized.
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      resolvedMessage = 'Internal server error';
      errorCode = 'INTERNAL_SERVER_ERROR';
      details = undefined;

      const rawMessage = exception instanceof Error ? exception.message : String(exception);
      const rawStack = exception instanceof Error ? exception.stack : undefined;

      const sanitizedMessage = sanitizeLogMessage(rawMessage);
      const sanitizedStack = rawStack ? sanitizeLogMessage(rawStack) : undefined;

      this.logger.error(
        `[${request.method}] ${request.url} Status: 500 - Internal Server Error: ${sanitizedMessage}`,
        sanitizedStack,
      );
    }

    const errorPayload: ApiErrorPayload = {
      code: errorCode,
      message: resolvedMessage,
      ...(details && details.length > 0 ? { details } : {}),
    };

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ||
      (request.headers['x-correlation-id'] as string | undefined);

    // Conforms strictly to OpenAPI v1.2 ErrorEnvelope:
    // Only `error` (required) and `requestId` (optional).
    // `additionalProperties: false` is strictly respected: no `success`, no `statusCode`, no `timestamp`, no `path`.
    const errorBody: ErrorEnvelope = {
      error: errorPayload,
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(errorBody);
  }
}

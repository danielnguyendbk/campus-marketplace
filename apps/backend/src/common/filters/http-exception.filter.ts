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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
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

      this.logger.warn(
        `[${request.method}] ${request.url} Status: ${status} [${errorCode}] - ${resolvedMessage}`,
      );
    } else {
      // NON-HTTP EXCEPTION (PostgreSQL errors, TypeError, internal runtime crashes)
      // SECURITY DIRECTIVE: All non-HttpExceptions MUST return HTTP 500 with a safe public message.
      // Under no circumstances should exception.message, database connection info, or stack traces leak to the client.
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      resolvedMessage = 'Internal server error';
      errorCode = 'INTERNAL_SERVER_ERROR';
      details = undefined;

      this.logger.error(
        `[${request.method}] ${request.url} Status: 500 - Internal Server Error: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
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

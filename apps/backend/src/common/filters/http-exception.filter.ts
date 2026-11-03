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
  ApiErrorResponse,
} from '../interfaces/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let resolvedMessage = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let details: ApiErrorDetail[] | undefined = undefined;

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
    } else if (exception instanceof Error) {
      resolvedMessage = exception.message;
      errorCode = exception.name.toUpperCase().replace(/\s+/g, '_');
    }

    // Default fallback mapping based on HTTP status code if code is generic
    if (errorCode === 'INTERNAL_SERVER_ERROR' || errorCode === 'ERROR') {
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
      }
    }

    this.logger.error(
      `[${request.method}] ${request.url} Status: ${status} - Error: ${resolvedMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const errorPayload: ApiErrorPayload = {
      code: errorCode,
      message: resolvedMessage,
      ...(details && details.length > 0 ? { details } : {}),
    };

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ||
      (request.headers['x-correlation-id'] as string | undefined);

    const errorBody: ApiErrorResponse = {
      success: false,
      statusCode: status,
      message: resolvedMessage,
      error: errorPayload,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(errorBody);
  }
}

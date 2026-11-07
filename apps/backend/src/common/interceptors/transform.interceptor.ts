import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  PaginatedResponse,
  PageMeta,
} from '../interfaces/api-response.interface';

function isPaginatedResult(data: unknown): data is { data: unknown[]; meta: PageMeta } {
  return (
    data !== null &&
    typeof data === 'object' &&
    'data' in data &&
    Array.isArray((data as Record<string, unknown>).data) &&
    'meta' in data &&
    (data as Record<string, unknown>).meta !== null &&
    typeof (data as Record<string, unknown>).meta === 'object' &&
    'page' in ((data as Record<string, unknown>).meta as Record<string, unknown>) &&
    'limit' in ((data as Record<string, unknown>).meta as Record<string, unknown>) &&
    'total' in ((data as Record<string, unknown>).meta as Record<string, unknown>) &&
    'totalPages' in ((data as Record<string, unknown>).meta as Record<string, unknown>)
  );
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | PaginatedResponse<unknown>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | PaginatedResponse<unknown>> {
    return next.handle().pipe(
      map((data) => {
        const timestamp = new Date().toISOString();

        if (isPaginatedResult(data)) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
            timestamp,
          };
        }

        return {
          success: true,
          data,
          timestamp,
        };
      }),
    );
  }
}

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { PageMeta, PaginatedResponse } from '../interfaces/api-response.interface';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockContext = {} as ExecutionContext;
  });

  const createCallHandler = (returnValue: unknown): CallHandler => ({
    handle: () => of(returnValue),
  });

  describe('Single Entity Responses', () => {
    it('should wrap a standard object into { success: true, data, timestamp }', async () => {
      const payload = { id: 'post-1', title: 'Sách Giải tích 1', price: 50000 };
      const callHandler = createCallHandler(payload);

      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      expect(result).toEqual({
        success: true,
        data: payload,
        timestamp: expect.any(String),
      });

      // Verify ISO 8601 timestamp
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      // Verify strict contract: NO extra top-level fields (additionalProperties: false)
      expect(Object.keys(result).sort()).toEqual(['data', 'success', 'timestamp']);
    });

    it('should wrap primitive data (string, number, boolean) correctly', async () => {
      const callHandlerStr = createCallHandler('operation completed');
      const resultStr = await lastValueFrom(interceptor.intercept(mockContext, callHandlerStr));
      expect(resultStr.data).toBe('operation completed');
      expect(resultStr.success).toBe(true);

      const callHandlerNum = createCallHandler(42);
      const resultNum = await lastValueFrom(interceptor.intercept(mockContext, callHandlerNum));
      expect(resultNum.data).toBe(42);
      expect(resultNum.success).toBe(true);
    });

    it('should wrap null payload without error', async () => {
      const callHandler = createCallHandler(null);
      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      expect(result).toEqual({
        success: true,
        data: null,
        timestamp: expect.any(String),
      });
      expect(Object.keys(result).sort()).toEqual(['data', 'success', 'timestamp']);
    });

    it('should not treat object with data array but missing meta as paginated', async () => {
      const payload = { data: [1, 2, 3] }; // no meta
      const callHandler = createCallHandler(payload);

      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      expect(result).toEqual({
        success: true,
        data: payload,
        timestamp: expect.any(String),
      });
      expect(result).not.toHaveProperty('meta');
      expect(Object.keys(result).sort()).toEqual(['data', 'success', 'timestamp']);
    });

    it('should not treat object with incomplete meta as paginated', async () => {
      const payload = { data: [{ id: 1 }], meta: { page: 1 } }; // missing limit, total, totalPages
      const callHandler = createCallHandler(payload);

      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      expect(result).toEqual({
        success: true,
        data: payload,
        timestamp: expect.any(String),
      });
      expect(result).not.toHaveProperty('meta');
    });
  });

  describe('Paginated Responses (Root-Level data and meta)', () => {
    it('should place data and meta at root level alongside success and timestamp', async () => {
      const meta: PageMeta = {
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
      };
      const items = [
        { id: 'post-1', title: 'Sách Đại số tuyến tính' },
        { id: 'post-2', title: 'Giáo trình C++' },
      ];
      const paginatedInput = {
        data: items,
        meta,
      };

      const callHandler = createCallHandler(paginatedInput);
      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      // Root-level fields validation
      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
      expect((result as PaginatedResponse<unknown>).meta).toEqual(meta);
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      // Crucial: Ensure NO nested data: { data, meta } structure
      expect(result.data).not.toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);

      // Strict envelope keys check: exactly ['data', 'meta', 'success', 'timestamp']
      expect(Object.keys(result).sort()).toEqual(['data', 'meta', 'success', 'timestamp']);
    });

    it('should handle empty paginated result correctly', async () => {
      const meta: PageMeta = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      };
      const paginatedInput = {
        data: [],
        meta,
      };

      const callHandler = createCallHandler(paginatedInput);
      const result = await lastValueFrom(interceptor.intercept(mockContext, callHandler));

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect((result as PaginatedResponse<unknown>).meta).toEqual(meta);
      expect(Object.keys(result).sort()).toEqual(['data', 'meta', 'success', 'timestamp']);
    });
  });
});

import { AllExceptionsFilter } from './http-exception.filter';
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string; headers: Record<string, string> };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/v1/posts/1',
      headers: { 'x-request-id': 'req-test-123' },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats NotFoundException with structured ErrorEnvelope', () => {
    const exception = new NotFoundException('Bài đăng không tồn tại');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        message: 'Bài đăng không tồn tại',
        error: {
          code: 'NOT_FOUND',
          message: 'Bài đăng không tồn tại',
        },
        path: '/api/v1/posts/1',
        requestId: 'req-test-123',
        timestamp: expect.any(String),
      }),
    );
  });

  it('formats BadRequestException with validation error details', () => {
    const validationErrors = ['title must not be empty', 'price must be positive'];
    const exception = new BadRequestException({
      message: validationErrors,
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'title must not be empty, price must be positive',
        error: {
          code: 'VALIDATION_FAILED',
          message: 'title must not be empty, price must be positive',
          details: [
            { message: 'title must not be empty' },
            { message: 'price must be positive' },
          ],
        },
        requestId: 'req-test-123',
      }),
    );
  });

  it('formats ForbiddenException for unverified user correctly', () => {
    const exception = new ForbiddenException({
      code: 'ACCOUNT_NOT_VERIFIED',
      message: 'Tài khoản chưa được phê duyệt',
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 403,
        error: {
          code: 'ACCOUNT_NOT_VERIFIED',
          message: 'Tài khoản chưa được phê duyệt',
        },
      }),
    );
  });

  it('handles unknown generic Errors with status 500', () => {
    const exception = new Error('Database connection timeout');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: {
          code: 'ERROR',
          message: 'Database connection timeout',
        },
      }),
    );
  });
});

import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

export const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): ApiErrorDetail[] => {
  const details: ApiErrorDetail[] = [];
  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    for (const message of Object.values(error.constraints ?? {})) {
      details.push({ field, message });
    }
    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }
  return details;
};

/**
 * Global validation pipe.
 * - whitelist + forbidNonWhitelisted mirrors `additionalProperties: false` in OpenAPI v1.2.
 * - Produces an ErrorEnvelope-compatible payload `{ code, message, details[{ field, message }] }`
 *   which AllExceptionsFilter forwards unchanged.
 */
export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: flattenValidationErrors(errors),
      }),
  });


import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from './validation.pipe';
import { RequestOtpDto } from '../../modules/auth/dto/request-otp.dto';

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();
  const meta: ArgumentMetadata = {
    type: 'body',
    metatype: RequestOtpDto,
  };

  it('transforms and trims valid DTO inputs', async () => {
    const result = await pipe.transform({ email: '  student@ptit.edu.vn  ' }, meta);
    expect(result).toEqual({ email: 'student@ptit.edu.vn' });
  });

  it('rejects non-whitelisted properties with VALIDATION_FAILED and field details', async () => {
    await expect(
      pipe.transform({ email: 'student@ptit.edu.vn', role: 'ADMIN' }, meta),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'role' }),
        ]),
      },
    });
  });

  it('rejects malformed email with VALIDATION_FAILED', async () => {
    try {
      await pipe.transform({ email: 'not-an-email' }, meta);
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as {
        code: string;
        details: { field?: string; message: string }[];
      };
      expect(response.code).toBe('VALIDATION_FAILED');
      expect(response.details.some((d) => d.field === 'email')).toBe(true);
    }
  });
});


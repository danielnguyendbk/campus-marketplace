import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const parseStrictOptionalInt = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return value;
    }
    return Number(trimmed);
  }
  return value;
};

/**
 * Pagination query parameters for GET /api/v1/feed (OpenAPI #/paths/~1feed/get).
 */
export class GetFeedQueryDto {
  @IsOptional()
  @Transform(parseStrictOptionalInt)
  @IsInt({ message: 'page phải là số nguyên.' })
  @Min(1, { message: 'page tối thiểu là 1.' })
  page?: number = 1;

  @IsOptional()
  @Transform(parseStrictOptionalInt)
  @IsInt({ message: 'limit phải là số nguyên.' })
  @Min(1, { message: 'limit tối thiểu là 1.' })
  @Max(100, { message: 'limit tối đa là 100.' })
  limit?: number = 20;
}

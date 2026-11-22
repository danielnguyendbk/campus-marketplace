import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListConversationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên.' })
  @Min(1, { message: 'page phải lớn hơn hoặc bằng 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên.' })
  @Min(1, { message: 'limit phải lớn hơn hoặc bằng 1.' })
  @Max(100, { message: 'limit tối đa là 100.' })
  limit?: number = 20;
}


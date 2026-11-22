import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang tối thiểu là 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giới hạn số bản ghi phải là số nguyên' })
  @Min(1, { message: 'Giới hạn tối thiểu là 1' })
  @Max(100, { message: 'Giới hạn tối đa là 100' })
  limit?: number = 20;
}


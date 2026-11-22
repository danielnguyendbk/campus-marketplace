import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi ký tự.' })
  @MaxLength(255, { message: 'Tên hiển thị tối đa 255 ký tự.' })
  displayName?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự.' })
  phoneNumber?: string | null;

  @IsOptional()
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Tỉnh/Thành phố tối đa 100 ký tự.' })
  province?: string;
}


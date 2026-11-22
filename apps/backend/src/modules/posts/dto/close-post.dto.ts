import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ClosePostDto {
  @IsString({ message: 'Lý do đóng bài đăng phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Lý do đóng bài đăng không được để trống.' })
  @MaxLength(100, { message: 'Lý do đóng bài đăng tối đa 100 ký tự.' })
  reason!: string;
}


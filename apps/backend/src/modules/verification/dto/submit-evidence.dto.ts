import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitEvidenceDto {
  @IsNotEmpty({ message: 'Tên trường học không được để trống.' })
  @IsString({ message: 'Tên trường học phải là chuỗi.' })
  @MaxLength(255, { message: 'Tên trường học tối đa 255 ký tự.' })
  school!: string;

  @IsOptional()
  @IsString({ message: 'Ngành học phải là chuỗi.' })
  @MaxLength(255, { message: 'Ngành học tối đa 255 ký tự.' })
  major?: string;

  @IsOptional()
  @IsString({ message: 'Lớp học phải là chuỗi.' })
  @MaxLength(100, { message: 'Lớp học tối đa 100 ký tự.' })
  className?: string;

  @IsNotEmpty({ message: 'Mã số sinh viên không được để trống.' })
  @IsString({ message: 'Mã số sinh viên phải là chuỗi.' })
  @MaxLength(50, { message: 'Mã số sinh viên tối đa 50 ký tự.' })
  studentCode!: string;

  @IsOptional()
  @IsString({ message: 'Khóa học phải là chuỗi.' })
  @MaxLength(50, { message: 'Khóa học tối đa 50 ký tự.' })
  cohort?: string;

  @IsOptional()
  @IsString({ message: 'Tỉnh/thành phố phải là chuỗi.' })
  @MaxLength(100, { message: 'Tỉnh/thành phố tối đa 100 ký tự.' })
  province?: string;
}

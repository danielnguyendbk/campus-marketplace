import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const parseBooleanDefaultTrue = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return value;
};

const parseStrictNumber = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    return Number(trimmed);
  }
  return NaN;
};

export class CreatePostDto {
  @Transform(trimString)
  @IsIn(['SELL'], {
    message: 'Loại bài đăng không hợp lệ. Hiện tại chỉ hỗ trợ SELL.',
  })
  postType!: 'SELL';

  @Transform(trimString)
  @IsString({ message: 'Tiêu đề bài đăng phải là chuỗi.' })
  @IsNotEmpty({ message: 'Tiêu đề bài đăng không được để trống.' })
  @MaxLength(255, { message: 'Tiêu đề bài đăng tối đa 255 ký tự.' })
  title!: string;

  @Transform(trimString)
  @IsString({ message: 'Mô tả sản phẩm phải là chuỗi.' })
  @IsNotEmpty({ message: 'Mô tả sản phẩm không được để trống.' })
  description!: string;

  @Transform(trimString)
  @IsString({ message: 'Danh mục sản phẩm phải là chuỗi.' })
  @IsNotEmpty({ message: 'Danh mục sản phẩm không được để trống.' })
  @MaxLength(100, { message: 'Mã danh mục tối đa 100 ký tự.' })
  categoryId!: string;

  @Transform(trimString)
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi.' })
  @IsNotEmpty({ message: 'Tỉnh/Thành phố không được để trống.' })
  @MaxLength(100, { message: 'Tỉnh/Thành phố tối đa 100 ký tự.' })
  province!: string;

  @Transform(parseStrictNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Giá bán phải là một số hợp lệ.' },
  )
  @Min(0.01, { message: 'Giá bán phải lớn hơn 0.' })
  price!: number;

  @Transform(trimString)
  @IsString({ message: 'Tình trạng sản phẩm phải là chuỗi.' })
  @IsNotEmpty({ message: 'Tình trạng sản phẩm không được để trống.' })
  @MaxLength(255, { message: 'Tình trạng sản phẩm tối đa 255 ký tự.' })
  condition!: string;

  @IsOptional()
  @Transform(parseBooleanDefaultTrue)
  @IsBoolean({ message: 'allowPhoneReveal phải là giá trị boolean.' })
  allowPhoneReveal?: boolean = true;
}

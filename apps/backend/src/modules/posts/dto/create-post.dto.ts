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
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const parseBooleanDefaultTrue = ({ value }: { value: unknown }): unknown => {
  // Keep absent values absent so the default is applied once, in PostsService.
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value === '') {
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
  // Preserve absence instead of coercing it to NaN, so optional-field
  // semantics stay correct regardless of class-transformer configuration.
  if (value === undefined || value === null) {
    return undefined;
  }
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
  @IsIn(['SELL', 'BUY_REQUEST'], {
    message: 'Loại bài đăng phải là SELL hoặc BUY_REQUEST.',
  })
  postType!: 'SELL' | 'BUY_REQUEST';

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

  @ValidateIf((o: CreatePostDto) => o.postType === 'SELL')
  @Transform(parseStrictNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Giá bán phải là một số hợp lệ.' },
  )
  @Min(0.01, { message: 'Giá bán phải lớn hơn 0.' })
  price?: number;

  @ValidateIf((o: CreatePostDto) => o.postType === 'SELL')
  @Transform(trimString)
  @IsString({ message: 'Tình trạng sản phẩm phải là chuỗi.' })
  @IsNotEmpty({ message: 'Tình trạng sản phẩm không được để trống.' })
  @MaxLength(255, { message: 'Tình trạng sản phẩm tối đa 255 ký tự.' })
  condition?: string;

  @ValidateIf((o: CreatePostDto) => o.postType === 'SELL')
  @IsOptional()
  @Transform(parseBooleanDefaultTrue)
  @IsBoolean({ message: 'allowPhoneReveal phải là giá trị boolean.' })
  allowPhoneReveal?: boolean;

  @ValidateIf((o: CreatePostDto) => o.postType === 'BUY_REQUEST')
  @Transform(parseStrictNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Ngân sách tối thiểu (budgetMin) phải là một số hợp lệ.' },
  )
  @Min(0, {
    message: 'Ngân sách tối thiểu (budgetMin) phải lớn hơn hoặc bằng 0.',
  })
  budgetMin?: number;

  @ValidateIf((o: CreatePostDto) => o.postType === 'BUY_REQUEST')
  @Transform(parseStrictNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'Ngân sách tối đa (budgetMax) phải là một số hợp lệ.' },
  )
  @Min(0, {
    message: 'Ngân sách tối đa (budgetMax) phải lớn hơn hoặc bằng 0.',
  })
  budgetMax?: number;
}

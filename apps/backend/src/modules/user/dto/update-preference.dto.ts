import { IsArray, IsString } from 'class-validator';

export class UpdatePreferenceDto {
  @IsArray({ message: 'favoriteCategoryIds phải là một mảng.' })
  @IsString({ each: true, message: 'Mỗi danh mục phải là chuỗi ký tự.' })
  favoriteCategoryIds!: string[];

  @IsArray({ message: 'interestKeywords phải là một mảng.' })
  @IsString({ each: true, message: 'Mỗi từ khóa phải là chuỗi ký tự.' })
  interestKeywords!: string[];
}


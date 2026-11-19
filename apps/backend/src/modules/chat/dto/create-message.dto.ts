import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
  @MaxLength(10000, { message: 'Nội dung tin nhắn không được vượt quá 10000 ký tự' })
  content!: string;
}


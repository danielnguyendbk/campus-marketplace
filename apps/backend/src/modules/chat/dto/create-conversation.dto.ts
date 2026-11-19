import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty({ message: 'postId không được để trống.' })
  @IsUUID('4', { message: 'postId phải là UUID hợp lệ.' })
  postId!: string;
}


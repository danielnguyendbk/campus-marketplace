import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  otpTicket!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 255)
  displayName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}


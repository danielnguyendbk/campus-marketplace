import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ReviewDecision } from '../verification.types';

export class ReviewVerificationDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'decision phải là APPROVED hoặc REJECTED',
  })
  decision!: ReviewDecision;

  @ValidateIf((o: ReviewVerificationDto) => o.decision === 'REJECTED')
  @IsNotEmpty({ message: 'Lý do từ chối là bắt buộc khi REJECTED' })
  @IsString({ message: 'Lý do từ chối phải là chuỗi văn bản' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  @IsOptional()
  reason?: string;
}


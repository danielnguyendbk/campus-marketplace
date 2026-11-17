import { VerificationStatus } from '../auth/auth.types';

export interface VerificationState {
  status: VerificationStatus;
  reason?: string | null;
  submittedAt?: string | null;
}

export interface StudentEvidenceRow {
  id: string;
  user_id: string;
  card_image_ref: string;
  submitted_at: Date;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  reason?: string | null;
}

export interface SubmitEvidenceData {
  school: string;
  major?: string;
  className?: string;
  studentCode: string;
  cohort?: string;
  province?: string;
}

export interface UploadedEvidenceFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export type ReviewDecision = 'APPROVED' | 'REJECTED';

export interface AdminVerification {
  id: string;
  userId: string;
  status: VerificationStatus;
  schoolEmail: string;
  displayName: string;
  school: string | null;
  studentCode: string | null;
  cardImageUrl: string;
  submittedAt: string;
  reason: string | null;
  reviewedAt: string | null;
}

export interface AdminVerificationDetailRow {
  id: string;
  user_id: string;
  card_image_ref: string;
  submitted_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reason: string | null;
  school_email: string;
  display_name: string;
  school: string | null;
  student_code: string | null;
  verification_status: VerificationStatus;
}

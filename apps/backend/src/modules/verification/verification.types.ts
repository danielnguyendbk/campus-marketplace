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


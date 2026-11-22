import { UserRole, VerificationStatus } from '../auth/auth.types';

export interface MeProfileDto {
  id: string;
  schoolEmail: string;
  displayName: string;
  phoneNumber: string | null;
  role: UserRole;
  verificationStatus: VerificationStatus;
  school: string | null;
  major: string | null;
  className: string | null;
  studentCode: string | null;
  cohort: string | null;
  province: string | null;
  reputationScore: number;
  createdAt: string;
}

export interface PreferenceDto {
  favoriteCategoryIds: string[];
  interestKeywords: string[];
  updatedAt: string;
}


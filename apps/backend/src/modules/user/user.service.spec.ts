import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository';
import {
  RawPreferenceRow,
  RawProfileRow,
  UserProfileRepository,
} from './repositories/user-profile.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userProfileRepo: jest.Mocked<UserProfileRepository>;
  let categoriesRepo: jest.Mocked<CategoriesRepository>;

  const mockDate = new Date('2026-11-01T09:00:00.000Z');

  const mockProfileRow: RawProfileRow = {
    id: 'user-uuid-1',
    school_email: 'student@example.edu.vn',
    display_name: 'Nguyễn Văn A',
    phone_number: '0901234567',
    role: 'USER',
    verification_status: 'APPROVED',
    school: 'PTIT',
    major: 'CNTT',
    class_name: 'D20CNTT1',
    student_code: 'B20DCCN001',
    cohort: '2020',
    province: 'Hà Nội',
    reputation_score: '5.0',
    created_at: mockDate,
  };

  const mockPreferenceRow: RawPreferenceRow = {
    user_id: 'user-uuid-1',
    favorite_category_ids: ['TEXTBOOK', 'ELECTRONICS'],
    interest_keywords: ['Java', 'Laptop'],
    updated_at: mockDate,
  };

  beforeEach(() => {
    userProfileRepo = {
      findProfileById: jest.fn(),
      updateProfile: jest.fn(),
      findPreferences: jest.fn(),
      upsertPreferences: jest.fn(),
    } as unknown as jest.Mocked<UserProfileRepository>;

    categoriesRepo = {
      findActiveById: jest.fn(),
    } as unknown as jest.Mocked<CategoriesRepository>;

    service = new UserService(userProfileRepo, categoriesRepo);
  });

  describe('getProfile', () => {
    it('should return mapped profile when user exists', async () => {
      userProfileRepo.findProfileById.mockResolvedValue(mockProfileRow);

      const result = await service.getProfile('user-uuid-1');

      expect(userProfileRepo.findProfileById).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({
        id: 'user-uuid-1',
        schoolEmail: 'student@example.edu.vn',
        displayName: 'Nguyễn Văn A',
        phoneNumber: '0901234567',
        role: 'USER',
        verificationStatus: 'APPROVED',
        school: 'PTIT',
        major: 'CNTT',
        className: 'D20CNTT1',
        studentCode: 'B20DCCN001',
        cohort: '2020',
        province: 'Hà Nội',
        reputationScore: 5.0,
        createdAt: '2026-11-01T09:00:00.000Z',
      });
      // Ensure password_hash and card_image_ref are not in the result
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).cardImageRef).toBeUndefined();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userProfileRepo.findProfileById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields successfully', async () => {
      userProfileRepo.updateProfile.mockResolvedValue({
        ...mockProfileRow,
        display_name: 'Nguyễn Văn B',
        phone_number: '0987654321',
        province: 'Đà Nẵng',
      });

      const result = await service.updateProfile('user-uuid-1', {
        displayName: '  Nguyễn Văn B  ',
        phoneNumber: ' 0987654321 ',
        province: '  Đà Nẵng  ',
      });

      expect(userProfileRepo.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        displayName: 'Nguyễn Văn B',
        phoneNumber: '0987654321',
        province: 'Đà Nẵng',
      });
      expect(result.displayName).toBe('Nguyễn Văn B');
      expect(result.phoneNumber).toBe('0987654321');
      expect(result.province).toBe('Đà Nẵng');
    });

    it('should allow setting phoneNumber to null', async () => {
      userProfileRepo.updateProfile.mockResolvedValue({
        ...mockProfileRow,
        phone_number: null,
      });

      const result = await service.updateProfile('user-uuid-1', {
        phoneNumber: null,
      });

      expect(userProfileRepo.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        phoneNumber: null,
      });
      expect(result.phoneNumber).toBeNull();
    });

    it('should throw BadRequestException if displayName is empty string or whitespace', async () => {
      await expect(
        service.updateProfile('user-uuid-1', { displayName: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found or updated row is null', async () => {
      userProfileRepo.updateProfile.mockResolvedValue(null);

      await expect(
        service.updateProfile('user-uuid-1', { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPreferences', () => {
    it('should return existing preferences when row exists', async () => {
      userProfileRepo.findPreferences.mockResolvedValue(mockPreferenceRow);

      const result = await service.getPreferences('user-uuid-1');

      expect(userProfileRepo.findPreferences).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({
        favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
        interestKeywords: ['Java', 'Laptop'],
        updatedAt: '2026-11-01T09:00:00.000Z',
      });
    });

    it('should return default empty preferences when record does not exist', async () => {
      userProfileRepo.findPreferences.mockResolvedValue(null);

      const result = await service.getPreferences('user-uuid-1');

      expect(result.favoriteCategoryIds).toEqual([]);
      expect(result.interestKeywords).toEqual([]);
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('updatePreferences', () => {
    it('should validate categories, deduplicate keywords, and upsert preferences', async () => {
      categoriesRepo.findActiveById.mockImplementation(async (id: string) => {
        if (id === 'TEXTBOOK' || id === 'ELECTRONICS') {
          return { id, name: id, slug: id.toLowerCase(), sort_order: 1 };
        }
        return null;
      });

      userProfileRepo.upsertPreferences.mockResolvedValue({
        user_id: 'user-uuid-1',
        favorite_category_ids: ['TEXTBOOK', 'ELECTRONICS'],
        interest_keywords: ['Java', 'Python'],
        updated_at: mockDate,
      });

      const result = await service.updatePreferences('user-uuid-1', {
        favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS', 'TEXTBOOK'],
        interestKeywords: [' Java ', 'Python', 'java', '   '],
      });

      expect(categoriesRepo.findActiveById).toHaveBeenCalledWith('TEXTBOOK');
      expect(categoriesRepo.findActiveById).toHaveBeenCalledWith('ELECTRONICS');
      expect(userProfileRepo.upsertPreferences).toHaveBeenCalledWith(
        'user-uuid-1',
        ['TEXTBOOK', 'ELECTRONICS'],
        ['Java', 'Python'],
      );
      expect(result).toEqual({
        favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
        interestKeywords: ['Java', 'Python'],
        updatedAt: '2026-11-01T09:00:00.000Z',
      });
    });

    it('should throw BadRequestException when category is invalid or inactive', async () => {
      categoriesRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.updatePreferences('user-uuid-1', {
          favoriteCategoryIds: ['INVALID_CAT'],
          interestKeywords: ['test'],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(userProfileRepo.upsertPreferences).not.toHaveBeenCalled();
    });
  });
});

import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MeProfileDto, PreferenceDto } from './user.types';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    schoolEmail: 'student@example.edu.vn',
    role: 'USER',
    verificationStatus: 'APPROVED',
    displayName: 'Nguyễn Văn A',
    reputationScore: 5.0,
    province: 'Hà Nội',
  };

  const mockProfile: MeProfileDto = {
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
  };

  const mockPreferences: PreferenceDto = {
    favoriteCategoryIds: ['TEXTBOOK'],
    interestKeywords: ['Java'],
    updatedAt: '2026-11-01T09:00:00.000Z',
  };

  beforeEach(() => {
    userService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    controller = new UserController(userService);
  });

  describe('getMyProfile', () => {
    it('should delegate to userService.getProfile with user.id', async () => {
      userService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockUser);

      expect(userService.getProfile).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toBe(mockProfile);
    });
  });

  describe('patchMyProfile', () => {
    it('should delegate to userService.updateProfile with user.id and dto', async () => {
      const dto = { displayName: 'Nguyễn Văn B' };
      userService.updateProfile.mockResolvedValue({
        ...mockProfile,
        displayName: 'Nguyễn Văn B',
      });

      const result = await controller.patchMyProfile(mockUser, dto);

      expect(userService.updateProfile).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result.displayName).toBe('Nguyễn Văn B');
    });
  });

  describe('getPreferences', () => {
    it('should delegate to userService.getPreferences with user.id', async () => {
      userService.getPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(mockUser);

      expect(userService.getPreferences).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toBe(mockPreferences);
    });
  });

  describe('setPreferences', () => {
    it('should delegate to userService.updatePreferences with user.id and dto', async () => {
      const dto = {
        favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
        interestKeywords: ['Java'],
      };
      userService.updatePreferences.mockResolvedValue({
        ...mockPreferences,
        favoriteCategoryIds: ['TEXTBOOK', 'ELECTRONICS'],
      });

      const result = await controller.setPreferences(mockUser, dto);

      expect(userService.updatePreferences).toHaveBeenCalledWith(
        'user-uuid-1',
        dto,
      );
      expect(result.favoriteCategoryIds).toEqual(['TEXTBOOK', 'ELECTRONICS']);
    });
  });
});


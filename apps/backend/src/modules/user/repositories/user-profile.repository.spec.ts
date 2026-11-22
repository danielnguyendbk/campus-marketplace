import { PostgresService } from '../../../database/postgres.service';
import { UserProfileRepository } from './user-profile.repository';

describe('UserProfileRepository', () => {
  let repository: UserProfileRepository;
  let postgresServiceMock: {
    query: jest.Mock;
  };

  beforeEach(() => {
    postgresServiceMock = {
      query: jest.fn(),
    };
    repository = new UserProfileRepository(
      postgresServiceMock as unknown as PostgresService,
    );
  });

  describe('findProfileById', () => {
    it('returns raw profile row when user exists', async () => {
      const mockRow = {
        id: 'user-1',
        school_email: 'student@ptithcm.edu.vn',
        display_name: 'Nguyen Van A',
        phone_number: '0987654321',
        role: 'USER',
        verification_status: 'APPROVED',
        school: 'PTIT',
        major: 'CNTT',
        class_name: 'D20CNTT1',
        student_code: 'B20DCCN001',
        cohort: '2020',
        province: 'TP. Hồ Chí Minh',
        reputation_score: '5.0',
        created_at: new Date('2026-11-01T00:00:00Z'),
      };
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repository.findProfileById('user-1');
      expect(result).toEqual(mockRow);
      expect(postgresServiceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM "users" u'),
        ['user-1'],
      );
    });

    it('returns null when user not found', async () => {
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findProfileById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates only provided fields and returns updated row', async () => {
      const mockUpdated = {
        id: 'user-1',
        display_name: 'Nguyen Van B',
        phone_number: '0912345678',
        province: 'Hà Nội',
      };
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await repository.updateProfile('user-1', {
        displayName: 'Nguyen Van B',
        phoneNumber: '0912345678',
        province: 'Hà Nội',
      });

      expect(result).toEqual(mockUpdated);
      expect(postgresServiceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "users"'),
        ['user-1', 'Nguyen Van B', '0912345678', 'Hà Nội'],
      );
    });
  });

  describe('findPreferences', () => {
    it('returns preferences row when found', async () => {
      const mockRow = {
        user_id: 'user-1',
        favorite_category_ids: ['TEXTBOOK'],
        interest_keywords: ['Java'],
        updated_at: new Date('2026-11-01T00:00:00Z'),
      };
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repository.findPreferences('user-1');
      expect(result).toEqual(mockRow);
    });

    it('returns null when preferences do not exist yet', async () => {
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findPreferences('user-1');
      expect(result).toBeNull();
    });
  });

  describe('upsertPreferences', () => {
    it('executes upsert and returns new preference row', async () => {
      const mockRow = {
        user_id: 'user-1',
        favorite_category_ids: ['TEXTBOOK', 'ELECTRONICS'],
        interest_keywords: ['Laptop', 'Sách'],
        updated_at: new Date('2026-11-01T00:00:00Z'),
      };
      postgresServiceMock.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repository.upsertPreferences(
        'user-1',
        ['TEXTBOOK', 'ELECTRONICS'],
        ['Laptop', 'Sách'],
      );

      expect(result).toEqual(mockRow);
      expect(postgresServiceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "user_preferences"'),
        ['user-1', ['TEXTBOOK', 'ELECTRONICS'], ['Laptop', 'Sách']],
      );
    });
  });
});


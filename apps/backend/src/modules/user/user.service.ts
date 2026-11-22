import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import {
  RawPreferenceRow,
  RawProfileRow,
  UserProfileRepository,
} from './repositories/user-profile.repository';
import { MeProfileDto, PreferenceDto } from './user.types';

@Injectable()
export class UserService {
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async getProfile(userId: string): Promise<MeProfileDto> {
    const row = await this.userProfileRepository.findProfileById(userId);
    if (!row) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy thông tin người dùng.',
      });
    }
    return this.mapProfile(row);
  }

  async updateProfile(userId: string, dto: UpdateMeDto): Promise<MeProfileDto> {
    const updateData: {
      displayName?: string;
      phoneNumber?: string | null;
      province?: string;
    } = {};

    if (dto.displayName !== undefined) {
      const trimmed = dto.displayName.trim();
      if (!trimmed) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Tên hiển thị không được để trống.',
          details: [
            {
              field: 'displayName',
              message: 'Tên hiển thị không được để trống.',
            },
          ],
        });
      }
      updateData.displayName = trimmed;
    }

    if (dto.phoneNumber !== undefined) {
      updateData.phoneNumber =
        dto.phoneNumber === null ? null : dto.phoneNumber.trim();
    }

    if (dto.province !== undefined) {
      updateData.province = dto.province.trim();
    }

    const updatedRow = await this.userProfileRepository.updateProfile(
      userId,
      updateData,
    );

    if (!updatedRow) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng hoặc tài khoản đã bị vô hiệu hóa.',
      });
    }

    return this.mapProfile(updatedRow);
  }

  async getPreferences(userId: string): Promise<PreferenceDto> {
    const row = await this.userProfileRepository.findPreferences(userId);
    if (!row) {
      return {
        favoriteCategoryIds: [],
        interestKeywords: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return this.mapPreferences(row);
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferenceDto,
  ): Promise<PreferenceDto> {
    const rawCategoryIds = dto.favoriteCategoryIds ?? [];
    const categoryIds = Array.from(
      new Set(
        rawCategoryIds.map((c) => c.trim()).filter((c) => c.length > 0),
      ),
    );

    const invalidCategoryIds: string[] = [];
    for (const catId of categoryIds) {
      const cat = await this.categoriesRepository.findActiveById(catId);
      if (!cat) {
        invalidCategoryIds.push(catId);
      }
    }

    if (invalidCategoryIds.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: `Danh mục sở thích không hợp lệ hoặc đã bị vô hiệu hóa: ${invalidCategoryIds.join(', ')}.`,
        details: invalidCategoryIds.map((id) => ({
          field: 'favoriteCategoryIds',
          message: `Danh mục '${id}' không tồn tại hoặc đã bị vô hiệu hóa.`,
        })),
      });
    }

    const rawKeywords = dto.interestKeywords ?? [];
    const interestKeywords: string[] = [];
    const seenKeywords = new Set<string>();

    for (const kw of rawKeywords) {
      const trimmed = kw.trim();
      if (trimmed.length > 0 && !seenKeywords.has(trimmed.toLowerCase())) {
        seenKeywords.add(trimmed.toLowerCase());
        interestKeywords.push(trimmed);
      }
    }

    const row = await this.userProfileRepository.upsertPreferences(
      userId,
      categoryIds,
      interestKeywords,
    );

    return this.mapPreferences(row);
  }

  private mapProfile(row: RawProfileRow): MeProfileDto {
    return {
      id: row.id,
      schoolEmail: row.school_email,
      displayName: row.display_name,
      phoneNumber: row.phone_number,
      role: row.role,
      verificationStatus: row.verification_status,
      school: row.school,
      major: row.major,
      className: row.class_name,
      studentCode: row.student_code,
      cohort: row.cohort,
      province: row.province,
      reputationScore: Number(row.reputation_score),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private mapPreferences(row: RawPreferenceRow): PreferenceDto {
    return {
      favoriteCategoryIds: row.favorite_category_ids ?? [],
      interestKeywords: row.interest_keywords ?? [],
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString(),
    };
  }
}


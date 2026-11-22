import { Module } from '@nestjs/common';
import { VerificationGuard } from '../../common/auth/verification.guard';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { UserProfileRepository } from './repositories/user-profile.repository';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [UserController],
  providers: [UserProfileRepository, UserService, VerificationGuard],
  exports: [UserProfileRepository, UserService],
})
export class UserModule {}


import { Module } from '@nestjs/common';
import { AuthService } from '@/application/auth.service';
import { AuthController } from '@/infrastructure/controllers/auth.controller';
import { InMemoryUserRepository } from '@/infrastructure/repository/in_memory_user.repository';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: AUTH_PROVIDER, useClass: StubAuthProvider },
  ],
})
export class AuthModule {}

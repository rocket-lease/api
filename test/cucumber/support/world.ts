import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });
import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/infrastructure/modules/app.module';
import { DomainExceptionFilter } from '@/infrastructure/filters/domain-exception.filter';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';
import { StubEmailProvider } from '@/infrastructure/providers/stub.email.provider';
import { StubSmsProvider } from '@/infrastructure/providers/stub.sms.provider';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { EMAIL_PROVIDER } from '@/domain/providers/email.provider';
import { SMS_PROVIDER } from '@/domain/providers/sms.provider';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PostgresVerificationOtpRepository } from '@/infrastructure/repository/postgres.verification-otp.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

interface GlobalContext {
  register_dto?: any;
  register_response?: any;
  login_response?: any;
  create_vehicle_dto?: any;
  create_vehicle_response?: any;
  last_user_id?: string;
  response?: any;
  last_otp_code?: { email?: string; phone?: string };
}

export interface MyWorld extends World {
  app: INestApplication;
  world: GlobalContext;
  initNest(): Promise<void>;
  cleanDb(): Promise<void>;
}

class CustomWorld extends World implements MyWorld {
  app: INestApplication;
  world: any;

  constructor(options: IWorldOptions) {
    super(options);
    this.world = {};
  }

  async initNest() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useClass(StubAuthProvider)
      .overrideProvider(EMAIL_PROVIDER)
      .useClass(StubEmailProvider)
      .overrideProvider(SMS_PROVIDER)
      .useClass(StubSmsProvider)
      .compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalFilters(new DomainExceptionFilter());
    await this.app.init();
  }

  async cleanDb() {
    const prisma = this.app.get(PrismaService);
    await prisma.verificationOtp.deleteMany({});
    const repo = this.app.get<PostgresUserRepository>(USER_REPOSITORY);
    await repo.clean();
    // also reset the otp repository state — handled by the deleteMany above
    void PostgresVerificationOtpRepository;
  }
}

setWorldConstructor(CustomWorld);

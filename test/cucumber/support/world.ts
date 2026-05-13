import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import type { Characteristic } from '@rocket-lease/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/infrastructure/modules/app.module';
import { DomainExceptionFilter } from '@/infrastructure/filters/domain-exception.filter';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import { StubMediaProvider } from './stub.media.provider';

interface GlobalContext {
  access_token?: any;
  enable_vehicle_response?: any;
  update_vehicle_dto?: any;
  update_vehicle_response?: any;
  delete_vehicle_response?: any;
  lastResponse?: any;
  register_dto?: any;
  register_response?: any;
  login_response?: any;
  create_vehicle_dto?: any;
  create_vehicle_response?: any;
  last_user_id?: string;
  response?: any;
  auth_token?: string;
  favorite_vehicle_id?: string;
  favorite_response?: any;
  profile_response?: any;
  update_profile_response?: any;
  upload_avatar_response?: any;
  profile_payload?: any;
  characteristics_vehicles?: Array<{ id: string; plate: string; characteristics: Characteristic[] }>;
  expected_filter_plates?: string[];
  current_characteristics?: Characteristic[];
  filter_response?: any;
  filter_characteristic?: Characteristic;
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
      .overrideProvider(MEDIA_PROVIDER)
      .useClass(StubMediaProvider)
      .compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalFilters(new DomainExceptionFilter());
    await this.app.init();
  }

  async cleanDb() {
    const repo = this.app.get<PostgresUserRepository>(USER_REPOSITORY);
    await this.app.get<PrismaService>(PrismaService).vehicle.deleteMany();
    await repo.clean();
  }
}

setWorldConstructor(CustomWorld);

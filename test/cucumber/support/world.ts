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
import { CLOCK } from '@/domain/providers/clock.provider';
import { StubMediaProvider } from './stub.media.provider';
import { FakeClock } from './fake-clock';

interface GlobalContext {
  access_token?: any;
  tokens_by_alias?: Record<string, string>;
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
  favorite_vehicle_id?: string;
  favorite_response?: any;
  profile_response?: any;
  update_profile_response?: any;
  upload_avatar_response?: any;
  profile_payload?: any;
  characteristics_vehicles?: Array<{
    id: string;
    plate: string;
    characteristics: Characteristic[];
  }>;
  expected_filter_plates?: string[];
  current_characteristics?: Characteristic[];
  filter_response?: any;
  filter_characteristic?: Characteristic;
  vehicle_by_plate?: Record<string, string>;
  reservation_response?: any;
  reservations_by_alias?: Record<string, string>;
  pre_made_reservations?: Array<{ alias: string; status: string }>;
}

export interface MyWorld extends World {
  app: INestApplication;
  world: GlobalContext;
  clock: FakeClock;
  initNest(): Promise<void>;
  cleanDb(): Promise<void>;
}

class CustomWorld extends World implements MyWorld {
  app: INestApplication;
  world: any;
  clock: FakeClock;

  constructor(options: IWorldOptions) {
    super(options);
    this.world = {};
    this.clock = new FakeClock();
  }

  async initNest() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useClass(StubAuthProvider)
      .overrideProvider(MEDIA_PROVIDER)
      .useClass(StubMediaProvider)
      .overrideProvider(CLOCK)
      .useValue(this.clock)
      .compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalFilters(new DomainExceptionFilter());
    await this.app.init();
    this.clock.set(new Date('2026-06-01T09:00:00Z'));
  }

  async cleanDb() {
    const prisma = this.app.get<PrismaService>(PrismaService);
    await prisma.reservation.deleteMany();
    const repo = this.app.get<PostgresUserRepository>(USER_REPOSITORY);
    await prisma.vehicle.deleteMany();
    await repo.clean();
  }
}

setWorldConstructor(CustomWorld);

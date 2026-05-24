import { Before, After } from '@cucumber/cucumber';
import { MyWorld } from './world';
import { PrismaService } from '@/infrastructure/database/prisma.service';

Before(async function (this: MyWorld) {
  await this.initNest();
  await this.cleanDb();

  const prisma = this.app.get<PrismaService>(PrismaService);

  await prisma.promotionLengthInDays.createMany({
    data: [
      { days: 7, valueInCents: 5000 },
      { days: 14, valueInCents: 9000 },
      { days: 30, valueInCents: 15000 },
    ],
    skipDuplicates: true,
  });
});

After(async function (
  this: MyWorld,
  scenario: { result?: { status?: string } },
) {
  if (scenario.result?.status === 'FAILED') {
    const responses = [
      this.world.create_vehicle_response,
      this.world.update_vehicle_response,
      this.world.delete_vehicle_response,
      this.world.enable_vehicle_response,
    ].filter(Boolean);
    if (responses.length > 0) {
      this.attach(JSON.stringify(responses, null, 2), 'application/json');
    }
  }
  if (this.app) {
    await this.app.close();
  }
});

import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { BankAccountModule } from './bank-account.module';
import { WalletService } from '@/application/wallet.service';
import { WalletController } from '@/infrastructure/controllers/wallet.controller';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { WALLET_REPOSITORY } from '@/domain/repositories/wallet.repository';
import { PostgresWalletRepository } from '@/infrastructure/repository/postgres.wallet.repository';

@Module({
  imports: [AuthModule, BankAccountModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    PrismaService,
    { provide: WALLET_REPOSITORY, useClass: PostgresWalletRepository },
  ],
  exports: [WalletService, WALLET_REPOSITORY],
})
export class WalletModule {}
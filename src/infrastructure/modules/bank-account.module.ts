import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { BankAccountService } from '@/application/bank-account.service';
import { BankAccountController } from '@/infrastructure/controllers/bank-account.controller';
import { BANK_ACCOUNT_PROVIDER } from '@/domain/providers/bank-account.provider';
import { BANK_ACCOUNT_REPOSITORY } from '@/domain/repositories/bank-account.repository';
import { StubBankAccountProvider } from '@/infrastructure/providers/stub.bank-account.provider';
import { PostgresBankAccountRepository } from '@/infrastructure/repository/postgres.bank-account.repository';

@Module({
  imports: [AuthModule],
  controllers: [BankAccountController],
  providers: [
    BankAccountService,
    { provide: BANK_ACCOUNT_PROVIDER, useClass: StubBankAccountProvider },
    { provide: BANK_ACCOUNT_REPOSITORY, useClass: PostgresBankAccountRepository },
  ],
  exports: [BankAccountService, BANK_ACCOUNT_PROVIDER, BANK_ACCOUNT_REPOSITORY],
})
export class BankAccountModule {}
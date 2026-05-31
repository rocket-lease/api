import { randomUUID } from 'node:crypto';
import { WalletService } from '@/application/wallet.service';
import { BankAccount } from '@/domain/entities/bank-account.entity';
import { WalletTransaction } from '@/domain/entities/wallet-transaction.entity';
import { Withdrawal } from '@/domain/entities/withdrawal.entity';
import { BankAccountRequiredException } from '@/domain/exceptions/domain.exception';
import { InsufficientBalanceException, InvalidWithdrawAmountException } from '@/domain/exceptions/wallet.exception';
import type { BankAccountProvider } from '@/domain/providers/bank-account.provider';
import type { BankAccountRepository } from '@/domain/repositories/bank-account.repository';
import type { WalletRepository } from '@/domain/repositories/wallet.repository';

function makeBankAccount(ownerId = randomUUID()) {
  return new BankAccount(
    randomUUID(),
    ownerId,
    'stub-bank-provider',
    'alias.stub',
    '1234567890123456789012',
    true,
    true,
  );
}

function makeWalletRepository(): jest.Mocked<WalletRepository> {
  return {
    getBalance: jest.fn(),
    findTransactionsByUserId: jest.fn(),
    recordReservationPayout: jest.fn(),
    recordWithdrawal: jest.fn(),
  };
}

function makeBankAccountRepository(accounts: BankAccount[]): jest.Mocked<BankAccountRepository> {
  return {
    save: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(async (id: string) => accounts.find((account) => account.getId() === id) ?? null),
    findByOwnerId: jest.fn(async (ownerId: string) => accounts.filter((account) => account.getOwnerId() === ownerId)),
  };
}

function makeProvider(): jest.Mocked<BankAccountProvider> {
  return {
    validateCbu: jest.fn((cbu: string) => cbu),
    validateBankAccount: jest.fn(),
    transferToBankAccount: jest.fn(),
  };
}

describe('WalletService', () => {
  it('returns the current balance and transactions', async () => {
    const walletRepository = makeWalletRepository();
    walletRepository.getBalance.mockResolvedValue({ balanceCents: 12500, currency: 'ARS' });
    walletRepository.findTransactionsByUserId.mockResolvedValue([
      new WalletTransaction({
        userId: randomUUID(),
        type: 'reservation_credit',
        amountCents: 2500,
        balanceAfterCents: 12500,
      }),
    ]);

    const service = new WalletService(
      walletRepository,
      makeBankAccountRepository([]),
      makeProvider(),
    );

    await expect(service.getBalance(randomUUID())).resolves.toEqual({ balanceCents: 12500, currency: 'ARS' });
    await expect(service.getTransactions(randomUUID())).resolves.toMatchObject({ items: [{ type: 'reservation_credit', amountCents: 2500 }] });
  });

  it('throws when withdrawing without a bank account', async () => {
    const service = new WalletService(
      makeWalletRepository(),
      makeBankAccountRepository([]),
      makeProvider(),
    );

    await expect(
      service.withdraw(randomUUID(), { bankAccountId: randomUUID(), amountCents: 1000 }),
    ).rejects.toBeInstanceOf(BankAccountRequiredException);
  });

  it('throws when withdrawing without enough balance', async () => {
    const ownerId = randomUUID();
    const account = makeBankAccount(ownerId);
    const walletRepository = makeWalletRepository();
    walletRepository.getBalance.mockResolvedValue({ balanceCents: 999, currency: 'ARS' });

    const service = new WalletService(
      walletRepository,
      makeBankAccountRepository([account]),
      makeProvider(),
    );

    await expect(
      service.withdraw(ownerId, { bankAccountId: account.getId(), amountCents: 1000 }),
    ).rejects.toBeInstanceOf(InsufficientBalanceException);
  });

  it('withdraws successfully through the provider and persists the movement', async () => {
    const ownerId = randomUUID();
    const account = makeBankAccount(ownerId);
    const walletRepository = makeWalletRepository();
    walletRepository.getBalance.mockResolvedValue({ balanceCents: 5000, currency: 'ARS' });
    walletRepository.recordWithdrawal.mockImplementation(async (input) => new Withdrawal({
      id: input.referenceId,
      userId: input.userId,
      bankAccountId: input.bankAccount.getId(),
      bankAccountAlias: input.bankAccount.getAlias(),
      bankAccountMaskedCbu: '1234**************9012',
      bankAccountProvider: input.bankAccount.getProvider(),
      amountCents: input.amountCents,
      providerName: input.providerName,
      providerTransactionId: input.providerTransactionId,
      providerStatus: input.providerStatus,
      status: input.status,
      providerMetadata: input.providerMetadata,
      balanceAfterCents: 4000,
      createdAt: input.createdAt,
      processedAt: input.processedAt,
    }));

    const provider = makeProvider();
    provider.transferToBankAccount.mockResolvedValue({
      providerTransactionId: 'payout-123',
      status: 'processed',
      metadata: { stub: true },
    });

    const service = new WalletService(
      walletRepository,
      makeBankAccountRepository([account]),
      provider,
    );

    const result = await service.withdraw(ownerId, {
      bankAccountId: account.getId(),
      amountCents: 1000,
    });

    expect(provider.transferToBankAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1000,
        currency: 'ARS',
        userId: ownerId,
        bankAccountAlias: account.getAlias(),
      }),
    );
    expect(walletRepository.recordWithdrawal).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'processed',
      providerTransactionId: 'payout-123',
      amountCents: 1000,
    });
  });

  it('rejects zero-value withdraw amounts with a typed error', async () => {
    const ownerId = randomUUID();
    const account = makeBankAccount(ownerId);
    const walletRepository = makeWalletRepository();
    walletRepository.getBalance.mockResolvedValue({ balanceCents: 5000, currency: 'ARS' });

    const service = new WalletService(
      walletRepository,
      makeBankAccountRepository([account]),
      makeProvider(),
    );

    await expect(
      service.withdraw(ownerId, { bankAccountId: account.getId(), amountCents: 0 }),
    ).rejects.toBeInstanceOf(InvalidWithdrawAmountException);
  });
});
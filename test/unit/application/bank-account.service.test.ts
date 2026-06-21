import { BankAccountService } from '@/application/bank-account.service';
import { BankAccount } from '@/domain/entities/bank-account.entity';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import type { BankAccountProvider } from '@/domain/providers/bank-account.provider';
import type { BankAccountRepository } from '@/domain/repositories/bank-account.repository';
import { randomUUID } from 'crypto';

const ownerId = randomUUID();

function makeBankAccount(overrideOwnerId?: string): BankAccount {
  return new BankAccount(
    randomUUID(),
    overrideOwnerId ?? ownerId,
    'BANCO_NACION',
    'mi.cuenta.nacion',
    '0110000000000000000001',
    true,
    true,
  );
}

describe('BankAccountService', () => {
  let service: BankAccountService;
  let repoMock: jest.Mocked<BankAccountRepository>;
  let providerMock: jest.Mocked<BankAccountProvider>;

  beforeEach(() => {
    repoMock = {
      save: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
    };
    providerMock = {
      validateCbu: jest.fn(),
      validateBankAccount: jest.fn(),
      transferToBankAccount: jest.fn(),
    };
    service = new BankAccountService(repoMock, providerMock);
  });

  describe('listMine', () => {
    it('retorna lista vacía cuando el owner no tiene cuentas', async () => {
      repoMock.findByOwnerId.mockResolvedValue([]);

      const result = await service.listMine(ownerId);

      expect(result).toHaveLength(0);
      expect(repoMock.findByOwnerId).toHaveBeenCalledWith(ownerId);
    });

    it('retorna las cuentas del owner con forma válida', async () => {
      const account1 = makeBankAccount();
      const account2 = makeBankAccount();
      repoMock.findByOwnerId.mockResolvedValue([account1, account2]);

      const result = await service.listMine(ownerId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(account1.getId());
      expect(result[0].ownerId).toBe(ownerId);
      expect(result[0].provider).toBe('BANCO_NACION');
      expect(result[0].alias).toBe('mi.cuenta.nacion');
      expect(result[0].cbu).toBe('0110000000000000000001');
      expect(result[0].maskedCbu).toBe('0110**************0001');
      expect(result[0].isActive).toBe(true);
      expect(result[0].isVerified).toBe(true);
      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[0].updatedAt).toBe('string');
      expect(result[0].deletedAt).toBeNull();
    });

    it('solo retorna cuentas del owner solicitado', async () => {
      const account = makeBankAccount();
      repoMock.findByOwnerId.mockResolvedValue([account]);

      await service.listMine(ownerId);

      expect(repoMock.findByOwnerId).toHaveBeenCalledWith(ownerId);
    });
  });

  describe('createBankAccount', () => {
    it('crea una cuenta bancaria válida y la retorna', async () => {
      const dto = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
      };
      const validated = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
        provider: 'BANCO_NACION',
        isVerified: true,
      };
      const savedAccount = makeBankAccount();

      providerMock.validateBankAccount.mockResolvedValue(validated);
      repoMock.save.mockResolvedValue(savedAccount);

      const result = await service.createBankAccount(ownerId, dto);

      expect(providerMock.validateBankAccount).toHaveBeenCalledWith(dto);
      expect(repoMock.save).toHaveBeenCalledWith(expect.any(BankAccount));
      expect(result.id).toBe(savedAccount.getId());
      expect(result.ownerId).toBe(ownerId);
      expect(result.provider).toBe('BANCO_NACION');
      expect(result.alias).toBe('mi.cuenta.nacion');
      expect(result.cbu).toBe('0110000000000000000001');
      expect(result.isActive).toBe(true);
      expect(result.isVerified).toBe(true);
    });

    it('valida la cuenta bancaria con el provider antes de guardar', async () => {
      const dto = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
      };
      const validated = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
        provider: 'BANCO_NACION',
        isVerified: true,
      };

      providerMock.validateBankAccount.mockResolvedValue(validated);
      repoMock.save.mockResolvedValue(makeBankAccount());

      await service.createBankAccount(ownerId, dto);

      expect(providerMock.validateBankAccount).toHaveBeenCalledWith(dto);
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('crea una nueva cuenta con UUID único', async () => {
      const dto = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
      };
      const validated = {
        alias: 'mi.cuenta.nacion',
        cbu: '0110000000000000000001',
        provider: 'BANCO_NACION',
        isVerified: true,
      };

      providerMock.validateBankAccount.mockResolvedValue(validated);
      repoMock.save.mockResolvedValue(makeBankAccount());

      await service.createBankAccount(ownerId, dto);

      const savedCall = repoMock.save.mock.calls[0];
      const savedAccount = savedCall[0];
      expect(savedAccount.getId()).toBeDefined();
      expect(savedAccount.getOwnerId()).toBe(ownerId);
    });
  });

  describe('deleteBankAccount', () => {
    it('elimina la cuenta cuando existe y pertenece al owner', async () => {
      const accountId = randomUUID();
      const account = makeBankAccount(ownerId);
      repoMock.findById.mockResolvedValue(account);
      repoMock.delete.mockResolvedValue(undefined);

      await service.deleteBankAccount(ownerId, accountId);

      expect(repoMock.findById).toHaveBeenCalledWith(accountId);
      expect(repoMock.delete).toHaveBeenCalledWith(accountId);
    });

    it('lanza EntityNotFoundException si la cuenta no existe', async () => {
      const accountId = randomUUID();
      repoMock.findById.mockResolvedValue(null);

      await expect(
        service.deleteBankAccount(ownerId, accountId),
      ).rejects.toThrow(EntityNotFoundException);

      expect(repoMock.delete).not.toHaveBeenCalled();
    });

    it('lanza EntityNotFoundException si la cuenta pertenece a otro owner', async () => {
      const accountId = randomUUID();
      const otherOwnerId = randomUUID();
      const account = makeBankAccount(otherOwnerId);
      repoMock.findById.mockResolvedValue(account);

      await expect(
        service.deleteBankAccount(ownerId, accountId),
      ).rejects.toThrow(EntityNotFoundException);

      expect(repoMock.delete).not.toHaveBeenCalled();
    });

    it('lanza EntityNotFoundException si la cuenta está marcada como eliminada', async () => {
      const accountId = randomUUID();
      const account = makeBankAccount(ownerId);
      account.deactivate();
      repoMock.findById.mockResolvedValue(account);

      await expect(
        service.deleteBankAccount(ownerId, accountId),
      ).rejects.toThrow(EntityNotFoundException);

      expect(repoMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('hasPublishableBankAccount', () => {
    it('retorna true si existe una cuenta activa y verificada', async () => {
      const account = makeBankAccount(ownerId);
      repoMock.findByOwnerId.mockResolvedValue([account]);

      const result = await service.hasPublishableBankAccount(ownerId);

      expect(result).toBe(true);
    });

    it('retorna false si no hay cuentas', async () => {
      repoMock.findByOwnerId.mockResolvedValue([]);

      const result = await service.hasPublishableBankAccount(ownerId);

      expect(result).toBe(false);
    });

    it('retorna false si todas las cuentas están inactivas', async () => {
      const account = makeBankAccount(ownerId);
      account.deactivate();
      repoMock.findByOwnerId.mockResolvedValue([account]);

      const result = await service.hasPublishableBankAccount(ownerId);

      expect(result).toBe(false);
    });

    it('retorna false si las cuentas no están verificadas', async () => {
      const account = new BankAccount(
        randomUUID(),
        ownerId,
        'BANCO_NACION',
        'mi.cuenta.nacion',
        '0110000000000000000001',
        true,
        false,
      );
      repoMock.findByOwnerId.mockResolvedValue([account]);

      const result = await service.hasPublishableBankAccount(ownerId);

      expect(result).toBe(false);
    });

    it('retorna true si existe al menos una cuenta válida entre varias', async () => {
      const validAccount = makeBankAccount(ownerId);
      const inactiveAccount = new BankAccount(
        randomUUID(),
        ownerId,
        'BANCO_CIUDAD',
        'otro.nombre',
        '1234567890123456789012',
        false,
        true,
      );
      repoMock.findByOwnerId.mockResolvedValue([inactiveAccount, validAccount]);

      const result = await service.hasPublishableBankAccount(ownerId);

      expect(result).toBe(true);
    });
  });
});

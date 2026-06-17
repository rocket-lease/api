import { Inject, Injectable } from '@nestjs/common';
import type { TransactionManager } from '@/domain/providers/transaction.manager';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * Implementación de {@link TransactionManager} sobre la transacción interactiva
 * de Prisma. El `tx` que recibe el callback es el `Prisma.TransactionClient` que
 * los repositorios postgres castean para encolar sus escrituras en la misma
 * transacción.
 */
@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx));
  }
}

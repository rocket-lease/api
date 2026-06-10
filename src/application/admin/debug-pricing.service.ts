import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClearDebugDataResponse,
  EmitDebugSignalsRequest,
  EmitDebugSignalsResponse,
} from '@rocket-lease/contracts';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';

/**
 * Identidad sintética que firma toda la data fabricada por el panel de debug.
 * Marcar las señales con este conductor permite borrarlas de un saque sin
 * tocar la data real ni el schema.
 */
const DEBUG_USER_ID = '00000000-0000-0000-0000-0000000deb06';
const DEBUG_SESSION_ID = 'debug:pricing-panel';

interface ResolvedTarget {
  kind: 'cell' | 'barrio';
  locationId?: string;
  cells: string[];
}

/**
 * Orquesta el panel de debug del pricing: suma o quita señales de demanda en
 * una celda o barrio para que el heatmap (que muestra la demanda viva) reaccione
 * al instante. Usa Prisma directo —es deliberadamente pragmático— y firma todo
 * con el usuario debug para poder limpiarlo. Solo se monta cuando
 * `PRICING_DEBUG_ENABLED` está activo; nunca en prod.
 */
@Injectable()
export class DebugPricingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Falla con 404 si el panel de debug no está habilitado, para que el
   * endpoint sea invisible fuera de entornos locales.
   */
  public assertEnabled(): void {
    if (process.env.PRICING_DEBUG_ENABLED !== 'true') {
      throw new NotFoundException('Pricing debug panel is disabled');
    }
  }

  /**
   * Suma (`add`) o quita (`remove`) `count` señales en la celda o barrio
   * indicado. La demanda viva del heatmap refleja el cambio al refrescar.
   */
  public async emit(
    request: EmitDebugSignalsRequest,
  ): Promise<EmitDebugSignalsResponse> {
    this.assertEnabled();
    const target = await this.resolveTarget(request);
    const affected =
      request.mode === 'remove'
        ? await this.removeSignals(target)
        : await this.addSignals(request, target);

    return {
      mode: request.mode,
      affected,
      targetCells: target.cells,
      message: this.buildMessage(request, target, affected),
    };
  }

  /**
   * Borra toda la data fabricada por el panel (señales y cualquier cotización
   * vieja firmada por el usuario debug).
   */
  public async clear(): Promise<ClearDebugDataResponse> {
    this.assertEnabled();
    const [quotes, signals] = await this.prisma.$transaction([
      this.prisma.priceQuote.deleteMany({
        where: { conductorId: DEBUG_USER_ID },
      }),
      this.prisma.searchLog.deleteMany({
        where: { conductorId: DEBUG_USER_ID },
      }),
    ]);
    return { deletedSignals: signals.count, deletedQuotes: quotes.count };
  }

  private async addSignals(
    request: EmitDebugSignalsRequest,
    target: ResolvedTarget,
  ): Promise<number> {
    await this.ensureDebugUser();
    const isCell = target.kind === 'cell';
    const now = this.clock.now();
    const rows = Array.from({ length: request.count }, () => ({
      sessionId: DEBUG_SESSION_ID,
      conductorId: DEBUG_USER_ID,
      h3Cell: isCell ? target.cells[0] : null,
      locationId: isCell ? null : target.locationId!,
      weight: 1,
      signal: request.signal,
      filters: {},
      createdAt: now,
    }));
    const result = await this.prisma.searchLog.createMany({ data: rows });
    return result.count;
  }

  /**
   * Quita TODA la demanda debug inyectada en la zona (no de a `count`): así un
   * solo click siempre hace bajar el multiplier de forma visible, en vez de
   * mordisquear señales mientras la celda sigue saturada.
   */
  private async removeSignals(target: ResolvedTarget): Promise<number> {
    const where =
      target.kind === 'cell'
        ? { conductorId: DEBUG_USER_ID, h3Cell: target.cells[0] }
        : { conductorId: DEBUG_USER_ID, locationId: target.locationId! };
    const result = await this.prisma.searchLog.deleteMany({ where });
    return result.count;
  }

  private async resolveTarget(
    request: EmitDebugSignalsRequest,
  ): Promise<ResolvedTarget> {
    if (request.h3Cell) {
      return { kind: 'cell', cells: [request.h3Cell] };
    }
    const location = await this.prisma.location.findUnique({
      where: { code: request.locationCode! },
    });
    if (!location) {
      throw new NotFoundException(
        `Location not found: ${request.locationCode!}`,
      );
    }
    const cells = await this.prisma.locationH3Cell.findMany({
      where: { locationId: location.id },
      select: { h3Cell: true },
    });
    return {
      kind: 'barrio',
      locationId: location.id,
      cells: cells.map((cell) => cell.h3Cell),
    };
  }

  private buildMessage(
    request: EmitDebugSignalsRequest,
    target: ResolvedTarget,
    affected: number,
  ): string {
    const where =
      target.kind === 'cell'
        ? `la celda ${target.cells[0]}`
        : `${request.locationCode!} (${target.cells.length} celdas)`;
    const verb = request.mode === 'remove' ? 'Quité' : 'Emití';
    return `${verb} ${affected} señales (${request.signal}) en ${where}.`;
  }

  private async ensureDebugUser(): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: DEBUG_USER_ID },
      update: {},
      create: {
        id: DEBUG_USER_ID,
        name: 'Pricing Debug',
        email: 'debug@pricing.local',
        dni: '00000000',
        phone: '0',
      },
    });
  }
}

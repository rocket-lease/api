import { SearchLogService } from '@/application/search-log.service';
import { SearchLog } from '@/domain/entities/search-log.entity';
import type { SearchLogRepository } from '@/domain/repositories/search-log.repository';
import type { Clock } from '@/domain/providers/clock.provider';
import type { GeoLocationService } from '@/application/geo-location.service';

const NOW = new Date('2026-06-10T12:00:00.000Z');

function buildService(lastLog: SearchLog | null) {
  const repository = {
    save: jest.fn().mockImplementation((log: SearchLog) => Promise.resolve(log)),
    findLastBySessionAndSignal: jest.fn().mockResolvedValue(lastLog),
  } as unknown as SearchLogRepository;
  const clock: Clock = { now: () => NOW };
  const geoLocationService = {
    findEnabledByCode: jest.fn().mockImplementation((code: string) =>
      Promise.resolve(
        code.startsWith('caba')
          ? { id: code, code, name: code, cityName: 'CABA' }
          : null,
      ),
    ),
  } as unknown as GeoLocationService;
  const service = new SearchLogService(repository, clock, geoLocationService);
  return { service, repository };
}

function searchLogAt(secondsAgo: number, locationId: string | null): SearchLog {
  return new SearchLog({
    sessionId: 'session-1',
    conductorId: null,
    h3Cell: locationId ? null : '88c2e30241fffff',
    locationId,
    filters: {},
    createdAt: new Date(NOW.getTime() - secondsAgo * 1000),
  });
}

describe('SearchLogService.maybeLog', () => {
  it('loguea una búsqueda por barrio con locationId y sin celda', async () => {
    const { service, repository } = buildService(null);

    await service.maybeLog({
      sessionId: 'session-1',
      conductorId: null,
      latitude: null,
      longitude: null,
      locationCode: 'caba-saavedra',
      filters: {},
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    const saved = (repository.save as jest.Mock).mock.calls[0][0] as SearchLog;
    expect(saved.getLocationId()).toBe('caba-saavedra');
    expect(saved.getH3Cell()).toBeNull();
  });

  it('suprime repetir el mismo barrio dentro de la ventana de debounce', async () => {
    const { service, repository } = buildService(
      searchLogAt(10, 'caba-belgrano'),
    );

    await service.maybeLog({
      sessionId: 'session-1',
      conductorId: null,
      latitude: null,
      longitude: null,
      locationCode: 'caba-belgrano',
      filters: {},
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('loguea un barrio distinto aunque haya una búsqueda reciente', async () => {
    const { service, repository } = buildService(
      searchLogAt(10, 'caba-belgrano'),
    );

    await service.maybeLog({
      sessionId: 'session-1',
      conductorId: null,
      latitude: null,
      longitude: null,
      locationCode: 'caba-saavedra',
      filters: {},
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    const saved = (repository.save as jest.Mock).mock.calls[0][0] as SearchLog;
    expect(saved.getLocationId()).toBe('caba-saavedra');
  });

  it('mantiene el debounce global para búsquedas por coordenadas', async () => {
    const { service, repository } = buildService(
      searchLogAt(10, 'caba-belgrano'),
    );

    await service.maybeLog({
      sessionId: 'session-1',
      conductorId: null,
      latitude: -34.55,
      longitude: -58.46,
      filters: {},
    });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('descarta el evento sin sesión o sin ancla espacial', async () => {
    const { service, repository } = buildService(null);

    await service.maybeLog({
      sessionId: null,
      conductorId: null,
      latitude: -34.55,
      longitude: -58.46,
      filters: {},
    });
    await service.maybeLog({
      sessionId: 'session-1',
      conductorId: null,
      latitude: null,
      longitude: null,
      filters: {},
    });

    expect(repository.save).not.toHaveBeenCalled();
  });
});

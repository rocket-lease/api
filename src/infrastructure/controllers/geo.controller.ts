import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { GeoService } from '@/application/geo.service';

function parseNumber(name: string, raw?: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new BadRequestException(`${name} must be a number`);
  }
  return n;
}

@Controller('geo')
export class GeoController {
  constructor(@Inject(GeoService) private readonly geoService: GeoService) {}

  /**
   * Marcadores de rentadoras para el mapa. Acepta viewport
   * (`north/south/east/west`) o "Cerca de mí" (`lat/lng/radiusKm`).
   */
  @Get('rentadoras')
  async getRentadoras(
    @Query('north') north?: string,
    @Query('south') south?: string,
    @Query('east') east?: string,
    @Query('west') west?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('zoom') zoom?: string,
    @Query('transmission') transmission?: string,
    @Query('maxPriceDaily') maxPriceDaily?: string,
    @Query('characteristics') characteristics?: string | string[],
    @Query('isAccessible') isAccessible?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<Contracts.MapSearchResponse> {
    const n = parseNumber('north', north);
    const s = parseNumber('south', south);
    const e = parseNumber('east', east);
    const w = parseNumber('west', west);
    const centerLat = parseNumber('lat', lat);
    const centerLng = parseNumber('lng', lng);
    const radius = parseNumber('radiusKm', radiusKm);

    const hasBounds =
      n !== undefined && s !== undefined && e !== undefined && w !== undefined;
    const hasRadius =
      centerLat !== undefined &&
      centerLng !== undefined &&
      radius !== undefined;

    const characteristicList = this.parseCharacteristics(characteristics);

    const candidate = {
      bounds: hasBounds ? { north: n, south: s, east: e, west: w } : undefined,
      center: hasRadius
        ? { latitude: centerLat, longitude: centerLng }
        : undefined,
      radiusKm: hasRadius ? radius : undefined,
      zoom: parseNumber('zoom', zoom),
      transmission: transmission || undefined,
      maxPriceDaily: parseNumber('maxPriceDaily', maxPriceDaily),
      characteristics:
        characteristicList.length > 0 ? characteristicList : undefined,
      isAccessible:
        isAccessible === undefined ? undefined : isAccessible === 'true',
      from: from || undefined,
      to: to || undefined,
    };

    const request = Contracts.MapSearchRequestSchema.parse(candidate);
    return this.geoService.searchRentadoras(request);
  }

  private parseCharacteristics(
    raw?: string | string[],
  ): Contracts.Characteristic[] {
    if (!raw) return [];
    const items = Array.isArray(raw) ? raw : raw.split(',');
    const result: Contracts.Characteristic[] = [];
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const parsed = Contracts.CharacteristicSchema.safeParse(trimmed);
      if (!parsed.success) {
        throw new BadRequestException(`invalid characteristic: ${trimmed}`);
      }
      result.push(parsed.data);
    }
    return result;
  }
}

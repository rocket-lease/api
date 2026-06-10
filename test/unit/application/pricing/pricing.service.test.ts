import { PricingService } from '@/application/pricing/pricing.service'
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception'
import { Vehicle } from '@/domain/entities/vehicle.entity'
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository'
import type { PriceQuoteRepository } from '@/domain/repositories/price-quote.repository'
import type { Clock } from '@/domain/providers/clock.provider'
import { PRICE_QUOTE_TTL_MS } from '@/application/pricing/config/dynamic-pricing.config'
import type { PricingQuoteRequest } from '@rocket-lease/contracts'
import { randomUUID } from 'crypto'

interface VehicleOverrides {
  id?: string
  basePriceCents?: number
  discountTiers?: Array<{ minimumDays: number; discountPercentage: number }>
  latitude?: number | null
  longitude?: number | null
  homeDeliveryEnabled?: boolean
  homeDeliveryFeeCents?: number | null
  homeReturnEnabled?: boolean
  homeReturnFeeCents?: number | null
  dynamicPricingEnabled?: boolean
}

function makeVehicle(overrides: VehicleOverrides = {}): Vehicle {
  return new Vehicle(
    overrides.id ?? randomUUID(),
    randomUUID(),
    'ABC123',
    'Toyota',
    'Corolla',
    2020,
    5,
    300,
    'Manual',
    false,
    true,
    ['https://example.com/photo.jpg'],
    [],
    'Blanco',
    0,
    overrides.basePriceCents ?? 10000,
    overrides.discountTiers ?? [],
    null,
    'Buenos Aires',
    'CABA',
    '2024-01-01',
    null,
    null,
    null,
    overrides.latitude !== undefined ? overrides.latitude : -34.6037,
    overrides.longitude !== undefined ? overrides.longitude : -58.3816,
    false,
    overrides.homeDeliveryEnabled ?? false,
    overrides.homeDeliveryFeeCents !== undefined ? overrides.homeDeliveryFeeCents : null,
    overrides.homeReturnEnabled ?? false,
    overrides.homeReturnFeeCents !== undefined ? overrides.homeReturnFeeCents : null,
    0,
    overrides.dynamicPricingEnabled ?? false,
  )
}

const START_AT = new Date('2026-06-10T00:00:00Z')
const END_AT = new Date('2026-06-12T00:00:00Z')

describe('PricingService', () => {
  let service: PricingService
  let vehicleRepoMock: jest.Mocked<VehicleRepository>
  let quoteRepoMock: jest.Mocked<PriceQuoteRepository>
  let clockMock: jest.Mocked<Clock>
  let dynamicPricingMock: { computeMultiplier: jest.Mock }

  beforeEach(() => {
    vehicleRepoMock = {
      save: jest.fn(),
      fetchAll: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByPlate: jest.fn(),
      findByOwnerId: jest.fn(),
      findByCharacteristics: jest.fn(),
      delete: jest.fn(),
      bulkUpdatePrices: jest.fn(),
      countActiveReservationsByVehicleIds: jest.fn(),
    }
    quoteRepoMock = {
      save: jest.fn(),
      findById: jest.fn(),
      countByHexSince: jest.fn(),
      aggregateMultiplierByH3Since: jest.fn(),
      deleteExpiredBefore: jest.fn(),
    }
    clockMock = {
      now: jest.fn().mockReturnValue(new Date('2026-06-07T12:00:00Z')),
    }
    dynamicPricingMock = {
      computeMultiplier: jest.fn().mockResolvedValue(1.0),
    }

    quoteRepoMock.save.mockImplementation(async (q) => q)

    service = new PricingService(
      vehicleRepoMock,
      quoteRepoMock,
      clockMock,
      dynamicPricingMock as any,
    )
  })

  // ─── quote ──────────────────────────────────────────────────────────────────

  describe('quote', () => {
    it('lanza EntityNotFoundException cuando el vehículo no existe', async () => {
      vehicleRepoMock.findById.mockResolvedValue(null)
      const request: PricingQuoteRequest = {
        vehicleId: randomUUID(),
        startAt: START_AT.toISOString(),
        endAt: END_AT.toISOString(),
      }

      await expect(service.quote(request, null)).rejects.toThrow(EntityNotFoundException)
    })

    it('vehículo encontrado sin conductorId → response con quoteToken, totalCents, multiplier y expiresAt ISO', async () => {
      const vehicle = makeVehicle()
      vehicleRepoMock.findById.mockResolvedValue(vehicle)
      const request: PricingQuoteRequest = {
        vehicleId: vehicle.getId(),
        startAt: START_AT.toISOString(),
        endAt: END_AT.toISOString(),
      }

      const result = await service.quote(request, null)

      expect(result.quoteToken).toBeDefined()
      expect(typeof result.totalCents).toBe('number')
      expect(result.multiplier).toBe(1.0)
      expect(typeof result.expiresAt).toBe('string')
    })

    it('vehículo encontrado con conductorId → save llamado con el conductorId correcto en el quote', async () => {
      const conductorId = randomUUID()
      const vehicle = makeVehicle()
      vehicleRepoMock.findById.mockResolvedValue(vehicle)
      const request: PricingQuoteRequest = {
        vehicleId: vehicle.getId(),
        startAt: START_AT.toISOString(),
        endAt: END_AT.toISOString(),
      }

      await service.quote(request, conductorId)

      const savedQuote = quoteRepoMock.save.mock.calls[0][0]
      expect(savedQuote.getConductorId()).toBe(conductorId)
    })
  })

  // ─── quoteForVehicle ────────────────────────────────────────────────────────

  describe('quoteForVehicle', () => {
    it('computeMultiplier devuelve 1.0 → multiplier en response es 1.0', async () => {
      const vehicle = makeVehicle({ dynamicPricingEnabled: false })

      const result = await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      expect(result.response.multiplier).toBe(1.0)
    })

    it('multiplier=1.3 → totalCents refleja el pricing dinámico (basePriceDailyCents × días × 1.3, sin descuento)', async () => {
      dynamicPricingMock.computeMultiplier.mockResolvedValue(1.3)
      const basePriceCents = 10000
      const vehicle = makeVehicle({ basePriceCents, dynamicPricingEnabled: true })
      // 2 días × 10000 = 20000; × 1.3 = 26000; sin descuento ni delivery
      const expectedTotalCents = Math.round(2 * basePriceCents * 1.3)

      const result = await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      expect(result.response.totalCents).toBe(expectedTotalCents)
    })

    it('withHomeDelivery=true → deliveryFeeCents en response igual a homeDeliveryFeeCents del vehículo', async () => {
      const homeDeliveryFeeCents = 500
      const vehicle = makeVehicle({ homeDeliveryEnabled: true, homeDeliveryFeeCents })

      const result = await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: true,
        withHomeReturn: false,
        conductorId: null,
      })

      expect(result.response.deliveryFeeCents).toBe(homeDeliveryFeeCents)
    })

    it('withHomeDelivery=false y withHomeReturn=false → deliveryFeeCents = 0', async () => {
      const vehicle = makeVehicle({
        homeDeliveryEnabled: true,
        homeDeliveryFeeCents: 500,
        homeReturnEnabled: true,
        homeReturnFeeCents: 300,
      })

      const result = await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      expect(result.response.deliveryFeeCents).toBe(0)
    })

    it('lat/lon nulos → h3Cell en el quote guardado es "unknown"', async () => {
      const vehicle = makeVehicle({ latitude: null, longitude: null })

      await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      const savedQuote = quoteRepoMock.save.mock.calls[0][0]
      expect(savedQuote.getH3Cell()).toBe('unknown')
    })

    it('expiresAt del quote guardado es now + PRICE_QUOTE_TTL_MS', async () => {
      const now = new Date('2026-06-07T12:00:00Z')
      const vehicle = makeVehicle()

      await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      const savedQuote = quoteRepoMock.save.mock.calls[0][0]
      expect(savedQuote.getExpiresAt().getTime()).toBe(now.getTime() + PRICE_QUOTE_TTL_MS)
    })

    it('llama a priceQuoteRepository.save() exactamente una vez', async () => {
      const vehicle = makeVehicle()

      await service.quoteForVehicle({
        vehicle,
        startAt: START_AT,
        endAt: END_AT,
        withHomeDelivery: false,
        withHomeReturn: false,
        conductorId: null,
      })

      expect(quoteRepoMock.save).toHaveBeenCalledTimes(1)
    })
  })
})

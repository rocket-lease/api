import { ExperienceTransaction } from '@/domain/entities/experience-transaction.entity';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { randomUUID } from 'crypto';

const profileId = randomUUID();
const reservationId = randomUUID();
const vehicleId = randomUUID();
const startAt = new Date('2026-06-10T10:00:00Z');
const endAt = new Date('2026-06-12T10:00:00Z');

function validProps() {
  return {
    profileId,
    amount: 100,
    reservationId,
    reservationVehicleName: 'Toyota Corolla',
    reservationVehicleId: vehicleId,
    reservationStartAt: startAt,
    reservationEndAt: endAt,
  };
}

describe('ExperienceTransaction', () => {
  it('crea entidad con todos los campos', () => {
    const tx = new ExperienceTransaction(validProps());
    expect(tx.getId()).toMatch(/^[0-9a-f-]+$/);
    expect(tx.getProfileId()).toBe(profileId);
    expect(tx.getAmount()).toBe(100);
    expect(tx.getReservationId()).toBe(reservationId);
    expect(tx.getReservationVehicleName()).toBe('Toyota Corolla');
    expect(tx.getReservationVehicleId()).toBe(vehicleId);
    expect(tx.getReservationStartAt()).toEqual(startAt);
    expect(tx.getReservationEndAt()).toEqual(endAt);
    expect(tx.getStatus()).toBe('pending');
    expect(tx.getCreatedAt()).toBeInstanceOf(Date);
  });

  it('asigna status pending por defecto', () => {
    const tx = new ExperienceTransaction(validProps());
    expect(tx.getStatus()).toBe('pending');
  });

  it('acepta status explícito', () => {
    const tx = new ExperienceTransaction({ ...validProps(), status: 'claimed' });
    expect(tx.getStatus()).toBe('claimed');
  });

  it('acepta id explícito', () => {
    const id = randomUUID();
    const tx = new ExperienceTransaction({ ...validProps(), id });
    expect(tx.getId()).toBe(id);
  });

  it('claim cambia status a claimed', () => {
    const tx = new ExperienceTransaction(validProps());
    expect(tx.getStatus()).toBe('pending');
    tx.claim();
    expect(tx.getStatus()).toBe('claimed');
  });

  it('getReservationSnapshot devuelve los datos de la reserva', () => {
    const tx = new ExperienceTransaction(validProps());
    const snap = tx.getReservationSnapshot();
    expect(snap).toEqual({
      id: reservationId,
      vehicleName: 'Toyota Corolla',
      vehicleId,
      startAt,
      endAt,
    });
  });

  it('lanza error si profileId no es UUID', () => {
    expect(() => new ExperienceTransaction({ ...validProps(), profileId: 'no-uuid' }))
      .toThrow(InvalidEntityDataException);
  });

  it('lanza error si amount es negativo', () => {
    expect(() => new ExperienceTransaction({ ...validProps(), amount: -1 }))
      .toThrow(InvalidEntityDataException);
  });

  it('lanza error si reservationVehicleName es vacío', () => {
    expect(() => new ExperienceTransaction({ ...validProps(), reservationVehicleName: '' }))
      .toThrow(InvalidEntityDataException);
  });

  it('lanza error si status es inválido', () => {
    expect(() => new ExperienceTransaction({ ...validProps(), status: 'expired' }))
      .toThrow(InvalidEntityDataException);
  });
});

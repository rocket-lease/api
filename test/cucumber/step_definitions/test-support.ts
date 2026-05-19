import { When } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { ReservationService } from '@/application/reservation.service';

When(
  'transcurren {int} minutos sin completar el pago',
  function (this: MyWorld, minutes: number) {
    this.clock.advanceMs(minutes * 60 * 1000);
  },
);

When(
  'el sistema ejecuta el job de expiración de reservas',
  async function (this: MyWorld) {
    const service = this.app.get(ReservationService);
    await service.expireOverdueReservations();
  },
);

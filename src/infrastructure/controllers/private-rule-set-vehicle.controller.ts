import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@/application/auth.service';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';

/**
 * Endpoint dedicado para acceder al set de reglas *privado* de un vehículo.
 * Vive en su propio controller (no en `VehicleController`) para evitar
 * colisiones de routing con `@Get(':id')` y para mantener la responsabilidad
 * del set de reglas dentro de `ReservationRuleSetModule`.
 *
 * Contract: `ReservationRuleSetEndpoints.getPrivateByVehicle(id)`
 * → `/vehicle/:id/private-rule-set`.
 */
@Controller('vehicle')
export class PrivateRuleSetVehicleController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ReservationRuleSetService) private readonly reservationRuleSetService: ReservationRuleSetService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  /**
   * Devuelve el set privado del vehículo, o `null` si el vehículo existe y es
   * del rentador autenticado pero todavía no tiene set privado asignado (estado
   * válido: usa set compartido o defaults). 404 si el vehículo no existe o no
   * pertenece al rentador.
   */
  @Get(':id/private-rule-set')
  public async getPrivateRuleSet(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') vehicleId: string,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.reservationRuleSetService.getPrivateForVehicle(vehicleId, userId);
  }
}

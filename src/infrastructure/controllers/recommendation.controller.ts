import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { RecommendationService } from '@/application/recommendation.service';
import { AuthService } from '@/application/auth.service';
import type {
  RecommendedVehiclesResponse,
  SearchAlternativesResponse,
} from '@rocket-lease/contracts';

@Controller()
export class RecommendationController {
  constructor(
    @Inject(RecommendationService)
    private readonly recommendationService: RecommendationService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  private async resolveUserId(
    authHeader: string | undefined,
  ): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token', {
        cause: error,
      });
    }
  }

  /**
   * GET /recommendations
   * Devuelve vehículos recomendados para el conductor autenticado.
   * Retorna sección vacía si no hay historial suficiente.
   */
  @Get('recommendations')
  async getRecommendations(
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<RecommendedVehiclesResponse> {
    const conductorId = await this.resolveUserId(authHeader);
    return this.recommendationService.getRecommendations(conductorId);
  }

  /**
   * GET /search/alternatives
   * Devuelve alternativas cercanas cuando una búsqueda no tiene resultados.
   * No requiere autenticación.
   */
  @Get('search/alternatives')
  async getSearchAlternatives(
    @Query('brand') brand?: string,
    @Query('model') model?: string,
    @Query('year') year?: string,
    @Query('transmission') transmission?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('city') city?: string,
    @Query('province') province?: string,
    @Query('characteristics') characteristics?: string,
  ): Promise<SearchAlternativesResponse> {
    return this.recommendationService.getSearchAlternatives({
      brand,
      model,
      year: year ? parseInt(year, 10) : undefined,
      transmission,
      maxPriceCents: maxPrice ? parseInt(maxPrice, 10) : undefined,
      city,
      province,
      characteristics: characteristics
        ? characteristics.split(',').map((c) => c.trim())
        : undefined,
    });
  }
}

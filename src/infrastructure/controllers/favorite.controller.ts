import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AddFavoriteRequestSchema,
  type AddFavoriteRequest,
  type AddFavoriteResponse,
  type ListFavoritesResponse,
} from '@rocket-lease/contracts';
import { FavoriteService } from '@/application/favorite.service';
import { AuthService } from '@/application/auth.service';

@Controller('favorites')
export class FavoriteController {
  constructor(
    private readonly favoriteService: FavoriteService,
    private readonly authService: AuthService,
  ) {}

  private async resolveConductorId(authHeader: string | undefined): Promise<string> {
    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');
    return this.authService.getUserIdFromToken(authHeader);
  }

  @Post()
  @HttpCode(201)
  async addFavorite(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: AddFavoriteRequest,
  ): Promise<AddFavoriteResponse> {
    const conductorId = await this.resolveConductorId(authHeader);
    const dto = AddFavoriteRequestSchema.parse(body);
    return this.favoriteService.addFavorite(conductorId, dto);
  }

  @Delete(':vehicleId')
  @HttpCode(204)
  async removeFavorite(
    @Headers('authorization') authHeader: string | undefined,
    @Param('vehicleId') vehicleId: string,
  ): Promise<void> {
    const conductorId = await this.resolveConductorId(authHeader);
    return this.favoriteService.removeFavorite(conductorId, vehicleId);
  }

  @Get()
  async listFavorites(
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<ListFavoritesResponse> {
    const conductorId = await this.resolveConductorId(authHeader);
    return this.favoriteService.listFavorites(conductorId);
  }
}

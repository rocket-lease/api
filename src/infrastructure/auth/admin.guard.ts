import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '@/application/auth.service';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { AdminForbiddenException } from '@/domain/exceptions/domain.exception';

/**
 * Guard que exige rol `admin` sobre el usuario autenticado. Se aplica con
 * `@UseGuards(AdminGuard)` sobre controllers o métodos del admin panel.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    let userId: string;
    try {
      userId = await this.authService.getUserIdFromToken(authHeader);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isAdmin()) {
      throw new AdminForbiddenException();
    }
    (request as Request & { userId?: string }).userId = userId;
    return true;
  }
}

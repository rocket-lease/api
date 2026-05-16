import {
  EmailNotVerifiedException,
  EntityAlreadyExistsException,
  EntityNotFoundException,
  FavoriteAlreadyExistsException,
  FavoriteNotFoundException,
  InvalidEntityDataException,
  UserHasVehiclesException,
} from '@/domain/exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  HoldExpiredException,
  InvalidReservationTransitionException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
} from '@/domain/exceptions/reservation.exception';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes } from '@rocket-lease/contracts';

function isZodError(
  error: Error,
): error is Error & { issues: Array<{ message: string }> } {
  return (
    error.name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

@Catch(Error)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;
    let code: string | undefined;

    if (
      exception instanceof FavoriteAlreadyExistsException ||
      exception instanceof EntityAlreadyExistsException ||
      exception instanceof UserHasVehiclesException
    ) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.ENTITY_ALREADY_EXISTS;
    } else if (
      exception instanceof FavoriteNotFoundException ||
      exception instanceof EntityNotFoundException
    ) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof ReservationNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.RESERVATION_NOT_FOUND;
    } else if (exception instanceof VehicleNotAvailableException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_VEHICLE_NOT_AVAILABLE;
    } else if (exception instanceof HoldExpiredException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_HOLD_EXPIRED;
    } else if (exception instanceof InvalidReservationTransitionException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_INVALID_TRANSITION;
    } else if (exception instanceof ContractNotAcceptedException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.RESERVATION_CONTRACT_NOT_ACCEPTED;
    } else if (exception instanceof OwnerCannotReserveOwnVehicleException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.RESERVATION_OWNER_CANNOT_RESERVE;
    } else if (exception instanceof ReservationForbiddenException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.RESERVATION_FORBIDDEN;
    } else if (exception instanceof EmailNotVerifiedException) {
      status = HttpStatus.FORBIDDEN;
    } else if (exception instanceof InvalidEntityDataException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
    } else if (isZodError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      message = exception.issues.map((i) => i.message).join('; ');
    }

    response.status(status).json({
      statusCode: status,
      message,
      code,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    });
  }
}

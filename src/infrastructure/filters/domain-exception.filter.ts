import {
  EmailNotVerifiedException,
  EmailUnverifiedPendingException,
  EntityAlreadyExistsException,
  EntityNotFoundException,
  FavoriteAlreadyExistsException,
  FavoriteNotFoundException,
  InvalidEntityDataException,
  UserHasActiveReservationsException,
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
  TransferExpiredException,
  VoucherNotFoundException,
  VoucherReservationCancelledException,
} from '@/domain/exceptions/reservation.exception';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorCodes,
  ProblemDetailsSchema,
  type ErrorCode,
} from '@rocket-lease/contracts';
import { ZodIssue } from 'zod/v3';

function isZodError(error: Error): error is Error & { issues: ZodIssue[] } {
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
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let title = 'Internal Server Error';
    let message = exception.message;
    // let code: string | undefined;

    if (exception instanceof UserHasActiveReservationsException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.USER_HAS_ACTIVE_RESERVATIONS;
      title = 'Conflict';
    } else if (exception instanceof EmailUnverifiedPendingException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.EMAIL_UNVERIFIED_PENDING;
      title = 'Conflict';
    } else if (
      exception instanceof FavoriteAlreadyExistsException ||
      exception instanceof EntityAlreadyExistsException ||
      exception instanceof UserHasVehiclesException
    ) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.ENTITY_ALREADY_EXISTS;
      title = 'Conflict';
    } else if (
      exception instanceof FavoriteNotFoundException ||
      exception instanceof EntityNotFoundException
    ) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.ENTITY_NOT_FOUND;
      title = 'Not Found';
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
    } else if (exception instanceof TransferExpiredException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_TRANSFER_EXPIRED;
    } else if (exception instanceof VoucherNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.VOUCHER_NOT_FOUND;
    } else if (exception instanceof VoucherReservationCancelledException) {
      status = HttpStatus.GONE;
      code = ErrorCodes.VOUCHER_RESERVATION_CANCELLED;
    } else if (exception instanceof EmailNotVerifiedException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.FORBIDDEN;
      title = 'Forbidden';
    } else if (exception instanceof InvalidEntityDataException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      title = 'Bad Request';
    } else if (isZodError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      title = 'Bad Request';
      message = exception.issues.map((i) => i.message).join('; ');
    } else if (exception instanceof UnauthorizedException) {
      status = HttpStatus.UNAUTHORIZED;
      code = ErrorCodes.UNAUTHORIZED;
      title = 'Unauthorized';
    } else if (exception instanceof ForbiddenException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.FORBIDDEN;
      title = 'Forbidden';
    } else if (exception instanceof BadRequestException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      title = 'Bad Request';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (status === HttpStatus.BAD_REQUEST) code = ErrorCodes.INVALID_ENTITY_DATA;
      if (status === HttpStatus.NOT_FOUND) code = ErrorCodes.ENTITY_NOT_FOUND;
      if (status === HttpStatus.CONFLICT) code = ErrorCodes.ENTITY_ALREADY_EXISTS;
      if (status === HttpStatus.UNAUTHORIZED) code = ErrorCodes.UNAUTHORIZED;
      if (status === HttpStatus.FORBIDDEN) code = ErrorCodes.FORBIDDEN;
      title = HttpStatus[status] ?? 'Error';
    }

    const problem = ProblemDetailsSchema.parse({
      type: `https://rocket-lease.local/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      detail: message,
      instance: request.url,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    });

    response.status(status).type('application/problem+json').json(problem);
  }
}

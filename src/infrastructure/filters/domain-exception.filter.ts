import {
  AdminForbiddenException,
  DepositPercentageOutOfRangeException,
  EmailNotVerifiedException,
  EmailUnverifiedPendingException,
  BankAccountRequiredException,
  EntityAlreadyExistsException,
  EntityNotFoundException,
  FavoriteAlreadyExistsException,
  FavoriteNotFoundException,
  InvalidEntityDataException,
  IdentityVerificationRequiredException,
  DriverLicenseVerificationRequiredException,
  PriceQuoteConductorMismatchException,
  PriceQuoteExpiredException,
  PriceQuoteNotFoundException,
  PriceQuoteVehicleMismatchException,
  RuleSetNotFoundForOwnerException,
  RuleSetPrivateCannotBeSharedException,
  RuleSetVehicleIdImmutableException,
  VehicleAlreadyHasPrivateRuleSetException,
  UserHasActiveReservationsException,
  UserHasVehiclesException,
} from '@/domain/exceptions/domain.exception';
import {
  InsufficientBalanceException,
  InvalidWithdrawAmountException,
} from '@/domain/exceptions/wallet.exception';
import {
  BulkPriceVehicleNotOwnedException,
  BulkPriceResultInvalidException,
} from '@/domain/exceptions/bulk-price.exception';
import {
  ContractNotAcceptedException,
  ExtensionInvalidEndAtException,
  ExtensionNotPendingException,
  ExtensionParentNotInProgressException,
  PendingExtensionExistsException,
  HoldExpiredException,
  InvalidReservationTransitionException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
  TransferExpiredException,
  VoucherNotFoundException,
  VoucherReservationCancelledException,
  InvalidQrTokenException,
  CancelExtensionNotAllowedException,
  DepositNotAvailableException,
  BalanceNotDueException,
  BalanceOverdueException,
  VehicleHomeDeliveryNotEnabledException,
  VehicleHomeReturnNotEnabledException,
  HomeDeliveryAddressRequiredException,
  HomeReturnAddressRequiredException,
} from '@/domain/exceptions/reservation.exception';
import {
  InvalidMapBoundsException,
  VehicleLocationRequiredException,
} from '@/domain/exceptions/geo.exception';
import { ChatNotAllowedException } from '@/domain/exceptions/messaging.exception';
import {
  TicketAlreadyExistsException,
  TicketNotFoundException,
  TicketReservationInvalidStatusException,
} from '@/domain/exceptions/ticket.exception';
import {
  UserSuspendedException,
} from '@/domain/exceptions/reputation.exception';
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

function prefixValidationError(message: string): string {
  const normalized = message.trim();
  if (/^validation error:/i.test(normalized)) {
    return normalized;
  }

  return `Validation error: ${normalized}`;
}

import * as fs from 'fs';

@Catch(Error)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    fs.appendFileSync('zod_error_log.txt', `\n--- NEW ERROR ---\nName: ${exception.name}\nMessage: ${exception.message}\nStack: ${exception.stack}\n`);
    if (isZodError(exception)) {
      fs.appendFileSync('zod_error_log.txt', `Zod Issues: ${JSON.stringify(exception.issues, null, 2)}\n`);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let title = 'Internal Server Error';
    let message = exception.message;

    if (exception instanceof UserHasActiveReservationsException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.USER_HAS_ACTIVE_RESERVATIONS;
      title = 'Conflict';
    } else if (exception instanceof EmailUnverifiedPendingException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.EMAIL_UNVERIFIED_PENDING;
      title = 'Conflict';
    } else if (exception instanceof BankAccountRequiredException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.BANK_ACCOUNT_REQUIRED;
      title = 'Forbidden';
    } else if (exception instanceof InvalidWithdrawAmountException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_WITHDRAW_AMOUNT;
      title = 'Bad Request';
    } else if (exception instanceof InsufficientBalanceException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.INSUFFICIENT_BALANCE;
      title = 'Conflict';
    } else if (exception instanceof IdentityVerificationRequiredException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.IDENTITY_VERIFICATION_REQUIRED;
      title = 'Forbidden';
    } else if (exception instanceof DriverLicenseVerificationRequiredException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.DRIVER_LICENSE_VERIFICATION_REQUIRED;
      title = 'Forbidden';
    } else if (exception instanceof UserHasVehiclesException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.USER_HAS_VEHICLES;
      title = 'Conflict';
    } else if (
      exception instanceof FavoriteAlreadyExistsException ||
      exception instanceof EntityAlreadyExistsException
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
    } else if (exception instanceof DepositNotAvailableException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_DEPOSIT_NOT_AVAILABLE;
    } else if (exception instanceof BalanceNotDueException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_BALANCE_NOT_DUE;
    } else if (exception instanceof BalanceOverdueException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_BALANCE_OVERDUE;
    } else if (exception instanceof VoucherNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.VOUCHER_NOT_FOUND;
    } else if (exception instanceof VoucherReservationCancelledException) {
      status = HttpStatus.GONE;
      code = ErrorCodes.VOUCHER_RESERVATION_CANCELLED;
    } else if (exception instanceof InvalidQrTokenException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.RESERVATION_INVALID_QR_TOKEN;
    } else if (exception instanceof ExtensionParentNotInProgressException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_EXTENSION_NOT_IN_PROGRESS;
    } else if (exception instanceof ExtensionInvalidEndAtException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.RESERVATION_EXTENSION_INVALID_END_AT;
      title = 'Bad Request';
    } else if (exception instanceof PendingExtensionExistsException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_EXTENSION_ALREADY_PENDING;
    } else if (exception instanceof ExtensionNotPendingException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_EXTENSION_NOT_PENDING;
    } else if (exception instanceof CancelExtensionNotAllowedException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.RESERVATION_CANCEL_EXTENSION_NOT_ALLOWED;
    } else if (exception instanceof DepositPercentageOutOfRangeException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.DEPOSIT_PERCENTAGE_OUT_OF_RANGE;
      title = 'Bad Request';
    } else if (exception instanceof RuleSetVehicleIdImmutableException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.RULESET_VEHICLE_ID_IMMUTABLE;
      title = 'Bad Request';
    } else if (exception instanceof RuleSetPrivateCannotBeSharedException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.RULESET_PRIVATE_CANNOT_BE_SHARED;
      title = 'Bad Request';
    } else if (exception instanceof RuleSetNotFoundForOwnerException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.RULESET_NOT_FOUND_FOR_OWNER;
      title = 'Not Found';
    } else if (exception instanceof VehicleAlreadyHasPrivateRuleSetException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.VEHICLE_ALREADY_HAS_PRIVATE_RULESET;
      title = 'Conflict';
    } else if (exception instanceof BulkPriceVehicleNotOwnedException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.BULK_PRICE_VEHICLE_NOT_OWNED;
      title = 'Forbidden';
    } else if (exception instanceof BulkPriceResultInvalidException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.BULK_PRICE_RESULT_INVALID;
      title = 'Bad Request';
    } else if (exception instanceof VehicleHomeDeliveryNotEnabledException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = ErrorCodes.VEHICLE_HOME_DELIVERY_NOT_ENABLED;
      title = 'Unprocessable Entity';
    } else if (exception instanceof VehicleHomeReturnNotEnabledException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = ErrorCodes.VEHICLE_HOME_RETURN_NOT_ENABLED;
      title = 'Unprocessable Entity';
    } else if (exception instanceof HomeDeliveryAddressRequiredException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.HOME_DELIVERY_ADDRESS_REQUIRED;
      title = 'Bad Request';
    } else if (exception instanceof HomeReturnAddressRequiredException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.HOME_RETURN_ADDRESS_REQUIRED;
      title = 'Bad Request';
    } else if (exception instanceof EmailNotVerifiedException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.FORBIDDEN;
      title = 'Forbidden';
    } else if (exception instanceof VehicleLocationRequiredException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.VEHICLE_LOCATION_REQUIRED;
      title = 'Bad Request';
    } else if (exception instanceof InvalidMapBoundsException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_MAP_BOUNDS;
      title = 'Bad Request';
    } else if (exception instanceof ChatNotAllowedException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = ErrorCodes.CHAT_NOT_ALLOWED;
      title = 'Unprocessable Entity';
    } else if (exception instanceof TicketNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.TICKET_NOT_FOUND;
      title = 'Not Found';
    } else if (exception instanceof TicketAlreadyExistsException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.TICKET_ALREADY_EXISTS;
      title = 'Conflict';
    } else if (exception instanceof TicketReservationInvalidStatusException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = ErrorCodes.TICKET_RESERVATION_INVALID_STATUS;
      title = 'Unprocessable Entity';
    } else if (exception instanceof PriceQuoteNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      code = ErrorCodes.PRICE_QUOTE_NOT_FOUND;
      title = 'Not Found';
    } else if (exception instanceof PriceQuoteExpiredException) {
      status = HttpStatus.GONE;
      code = ErrorCodes.PRICE_QUOTE_EXPIRED;
      title = 'Gone';
    } else if (exception instanceof PriceQuoteVehicleMismatchException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.PRICE_QUOTE_VEHICLE_MISMATCH;
      title = 'Conflict';
    } else if (exception instanceof PriceQuoteConductorMismatchException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.PRICE_QUOTE_CONDUCTOR_MISMATCH;
      title = 'Forbidden';
    } else if (exception instanceof AdminForbiddenException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.ADMIN_FORBIDDEN;
      title = 'Forbidden';
    } else if (exception instanceof UserSuspendedException) {
      status = HttpStatus.FORBIDDEN;
      code = ErrorCodes.USER_SUSPENDED;
      title = 'Forbidden';
    } else if (exception instanceof InvalidEntityDataException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      title = 'Bad Request';
    } else if (isZodError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.INVALID_ENTITY_DATA;
      title = 'Bad Request';
      message = prefixValidationError(exception.issues.map((i) => i.message).join('; '));
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

    if (status === HttpStatus.BAD_REQUEST) {
      message = prefixValidationError(message);
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

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
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let title = 'Internal Server Error';
    let message = exception.message;

    if (
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
    } else if (exception instanceof UserHasVehiclesException) {
      status = HttpStatus.CONFLICT;
      code = ErrorCodes.USER_HAS_VEHICLES;
      title = 'Conflict';
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
      timestamp,
      path: request.url,
    });

    response.status(status).type('application/problem+json').json(problem);
  }
}

import { EntityAlreadyExistsException, InvalidEntityDataException} from '@/domain/exceptions/domain.exception';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch(Error)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;

    if (exception instanceof EntityAlreadyExistsException) {
      status = HttpStatus.CONFLICT;
    } else if (exception instanceof InvalidEntityDataException) {
      status = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    });
  }
}

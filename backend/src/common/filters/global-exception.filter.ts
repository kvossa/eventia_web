import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../app-error.js';

interface ErrorEnvelope {
  statusCode: number;
  code: string;
  errors: string[];
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const envelope = this.toEnvelope(exception, request.url);

    if (envelope.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled ${envelope.statusCode} on ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown, path: string): ErrorEnvelope {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.status,
        code: exception.code,
        errors: [exception.message],
        path,
        timestamp: new Date().toISOString(),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const errors = this.extractMessages(raw);
      return {
        statusCode: status,
        code: this.statusToCode(status),
        errors,
        path,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      errors: ['Internal server error'],
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private extractMessages(raw: string | object): string[] {
    if (typeof raw === 'string') return [raw];
    const message = (raw as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message;
    if (typeof message === 'string') return [message];
    return [HttpStatus[((raw as { statusCode?: number }).statusCode ?? 500) as number] ?? 'Error'];
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'HTTP_ERROR';
    }
  }
}
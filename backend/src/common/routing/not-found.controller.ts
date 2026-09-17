import { All, Controller, NotFoundException } from '@nestjs/common';

@Controller()
export class NotFoundController {
  @All('{*splat}')
  notFound(): never {
    throw new NotFoundException('Route not found');
  }
}
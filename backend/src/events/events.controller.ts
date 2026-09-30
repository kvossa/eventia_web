import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { mkdirSync, unlink } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator.js';
import { CART_COOKIE } from '../common/cookies.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UPLOADS_URL_PREFIX, uploadPath } from '../common/uploads.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { AdminEventQueryDto, CreateEventDto, EventQueryDto, UpdateEventDto } from './dto/event.dto.js';
import { UpdateEventStatusDto } from './dto/event-status.dto.js';
import { EventsService } from './events.service.js';

const EVENT_IMAGE_FOLDER = 'events';
const EVENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const EVENT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const EVENT_IMAGE_FOLDER_PATH = uploadPath(EVENT_IMAGE_FOLDER);
mkdirSync(EVENT_IMAGE_FOLDER_PATH, { recursive: true });

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events (search/filter/paginate)' })
  list(@Query() query: EventQueryDto) {
    return this.eventsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Event detail with ticket types and availability' })
  detail(@Param('id') id: string) {
    return this.eventsService.detail(id);
  }

  @Get(':id/seat-map')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Seat map of a reserved-seating event (public)' })
  seatMap(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.eventsService.getSeatMap(id, {
      cartId: this.readCartId(req),
      userId: req.user?.sub ?? null,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an event (admin, defaults to draft)' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an event (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[deprecated] Use PATCH /admin/events/:id/status', deprecated: true })
  publish(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'published');
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[deprecated] Use PATCH /admin/events/:id/status', deprecated: true })
  unpublish(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'draft');
  }

  @Post(':id/mark-sold-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[deprecated] Use PATCH /admin/events/:id/status', deprecated: true })
  markSoldOut(@Param('id') id: string) {
    return this.eventsService.setStatus(id, 'sold_out');
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate an event incl. ticket types (admin, draft copy)' })
  duplicate(@Param('id') id: string) {
    return this.eventsService.duplicate(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete an event (admin)' })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  private readCartId(req: Request): string | null {
    const id = (req.cookies as Record<string, string | undefined> | undefined)?.[CART_COOKIE];
    return typeof id === 'string' && id ? id : null;
  }
}

@ApiTags('admin-events')
@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all events (admin, optional status filter)' })
  list(@Query() query: AdminEventQueryDto) {
    return this.eventsService.listAdmin(query);
  }

  @Get(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Event detail for any status (admin)' })
  detail(@Param('id') id: string) {
    return this.eventsService.detailAdmin(id);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set event status (admin, draft/published/sold_out)' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto) {
    return this.eventsService.setStatus(id, dto.status);
  }

  @Post(':id/image')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the event image (admin, PNG/JPEG/WebP/GIF up to 2 MB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: EVENT_IMAGE_FOLDER_PATH,
        filename: (_req, file, cb) => {
          const extension = EVENT_IMAGE_EXTENSIONS[file.mimetype] ?? extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: EVENT_IMAGE_MAX_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!EVENT_IMAGE_EXTENSIONS[file.mimetype]) {
          cb(new BadRequestException('Unsupported image type. Allowed types: PNG, JPEG, WebP, GIF.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('An image file is required.');
    const storedPath = `${EVENT_IMAGE_FOLDER}/${file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${UPLOADS_URL_PREFIX}/${storedPath}`;
    try {
      return await this.eventsService.setImage(id, absoluteUrl);
    } catch (err) {
      unlink(uploadPath(storedPath), () => undefined);
      throw err;
    }
  }
}
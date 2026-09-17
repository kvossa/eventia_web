import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { NotFoundModule } from './common/routing/not-found.module.js';
import { buildDataSourceOptions } from './config/database.config.js';
import { EntitiesModule } from './entities/entities.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { OrganizersModule } from './organizers/organizers.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { TicketTypesModule } from './ticket-types/ticket-types.module.js';
import { UsersModule } from './users/users.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60_000),
          limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions({
          host: config.getOrThrow<string>('DB_HOST'),
          port: Number(config.get('DB_PORT') ?? 5432),
          username: config.getOrThrow<string>('DB_USERNAME'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_DATABASE'),
        }),
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    EntitiesModule,
    UsersModule,
    CartModule,
    AuthModule,
    CategoriesModule,
    OrganizersModule,
    VenuesModule,
    EventsModule,
    TicketTypesModule,
    CheckoutModule,
    OrdersModule,
    TicketsModule,
    NotificationsModule,
    NotFoundModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
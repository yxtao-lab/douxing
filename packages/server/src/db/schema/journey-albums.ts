import {
  mysqlTable,
  int,
  varchar,
  bigint,
  tinyint,
  timestamp,
  decimal,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import type { TravelPhotoShootingParams } from '@douxing/shared';
import { users } from './users.js';
import { travelRoutes } from './travel-routes.js';

/** 旅程相册 · 一路线一册 */
export const journeyAlbums = mysqlTable(
  'journey_albums',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    routeId: int('route_id')
      .notNull()
      .references(() => travelRoutes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 128 }).notNull(),
    coverPhotoId: int('cover_photo_id'),
    photoCount: int('photo_count').notNull().default(0),
    bytesUsed: bigint('bytes_used', { mode: 'number', unsigned: true }).notNull().default(0),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    shareEnabled: tinyint('share_enabled').notNull().default(0),
    shareToken: varchar('share_token', { length: 32 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userRouteUnique: uniqueIndex('uk_journey_albums_user_route').on(table.userId, table.routeId),
    userIdx: index('idx_journey_albums_user').on(table.userId),
    routeIdx: index('idx_journey_albums_route').on(table.routeId),
    shareTokenUnique: uniqueIndex('uk_journey_albums_share_token').on(table.shareToken),
  }),
);

/** 旅行照片元数据 */
export const travelPhotos = mysqlTable(
  'travel_photos',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    albumId: int('album_id')
      .notNull()
      .references(() => journeyAlbums.id, { onDelete: 'cascade' }),
    storedUrl: varchar('stored_url', { length: 512 }).notNull(),
    byteSize: int('byte_size').notNull(),
    width: int('width'),
    height: int('height'),
    dayIndex: int('day_index'),
    poiName: varchar('poi_name', { length: 128 }),
    attractionId: int('attraction_id'),
    checkInId: int('check_in_id'),
    takenAt: timestamp('taken_at'),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    caption: varchar('caption', { length: 512 }),
    sortOrder: int('sort_order').notNull().default(0),
    source: varchar('source', { length: 16 }).notNull().default('upload'),
    shootingParams: json('shooting_params').$type<TravelPhotoShootingParams | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    albumIdx: index('idx_travel_photos_album').on(table.albumId),
    userIdx: index('idx_travel_photos_user').on(table.userId),
    dayPoiIdx: index('idx_travel_photos_day_poi').on(table.albumId, table.dayIndex, table.poiName),
  }),
);

export type JourneyAlbum = typeof journeyAlbums.$inferSelect;
export type NewJourneyAlbum = typeof journeyAlbums.$inferInsert;
export type TravelPhoto = typeof travelPhotos.$inferSelect;
export type NewTravelPhoto = typeof travelPhotos.$inferInsert;

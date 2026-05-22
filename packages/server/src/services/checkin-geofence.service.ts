import { eq, and, desc, sql } from 'drizzle-orm';
import {
  haversineDistanceMeters,
  CHECKIN_GEOFENCE_RADIUS_M,
  CHECKIN_GPS_MAX_ACCURACY_M,
  CHECKIN_MAX_SPEED_KMH,
  CHECKIN_SPEED_MIN_INTERVAL_SEC,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { checkIns } from '../db/schema/check-ins.js';
import { getAttractionForCheckIn } from './attraction.service.js';
import { isCheckinGeofenceEnabled } from '../config/checkin.js';
import { CheckinValidationError } from '../utils/checkin-errors.js';

type GeoPoint = { latitude: number; longitude: number };

async function resolveTargetPoint(input: {
  attractionId?: number;
  targetLatitude?: number;
  targetLongitude?: number;
}): Promise<GeoPoint> {
  if (input.attractionId) {
    const attraction = await getAttractionForCheckIn(input.attractionId);
    if (!attraction) {
      throw new CheckinValidationError('关联景点不存在或已禁用');
    }
    if (attraction.latitude == null || attraction.longitude == null) {
      throw new CheckinValidationError('该景点暂无坐标，无法打卡');
    }
    return {
      latitude: Number(attraction.latitude),
      longitude: Number(attraction.longitude),
    };
  }

  if (input.targetLatitude != null && input.targetLongitude != null) {
    return {
      latitude: input.targetLatitude,
      longitude: input.targetLongitude,
    };
  }

  throw new CheckinValidationError('无法确定打卡目标位置，请关联有效景点');
}

function assertGpsAccuracy(gpsAccuracy?: number) {
  if (gpsAccuracy == null) return;
  if (gpsAccuracy > CHECKIN_GPS_MAX_ACCURACY_M) {
    throw new CheckinValidationError(
      `定位精度不足（约 ${Math.round(gpsAccuracy)} 米），请到开阔处后重试`,
    );
  }
}

function assertWithinGeofence(user: GeoPoint, target: GeoPoint) {
  const distanceM = haversineDistanceMeters(
    user.latitude,
    user.longitude,
    target.latitude,
    target.longitude,
  );

  if (distanceM > CHECKIN_GEOFENCE_RADIUS_M) {
    throw new CheckinValidationError(
      `您距离景点约 ${Math.round(distanceM)} 米，需在 ${CHECKIN_GEOFENCE_RADIUS_M} 米内打卡`,
    );
  }

  return Math.round(distanceM);
}

async function assertReasonableTravelSpeed(userId: number, user: GeoPoint) {
  const db = getDb();
  const rows = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.checkedAt))
    .limit(1);

  const last = rows[0];
  if (!last?.location?.latitude || last.location.longitude == null) return;

  const elapsedSec = (Date.now() - last.checkedAt.getTime()) / 1000;
  if (elapsedSec < CHECKIN_SPEED_MIN_INTERVAL_SEC) return;

  const distanceM = haversineDistanceMeters(
    user.latitude,
    user.longitude,
    last.location.latitude,
    last.location.longitude,
  );
  const speedKmh = distanceM / 1000 / (elapsedSec / 3600);

  if (speedKmh > CHECKIN_MAX_SPEED_KMH) {
    throw new CheckinValidationError('位置变化异常，请稍后重试');
  }
}

export async function assertNotCheckedInToday(userId: number, attractionId?: number) {
  if (!attractionId) return;

  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.userId, userId),
        eq(checkIns.attractionId, attractionId),
        sql`DATE(${checkIns.checkedAt}) = CURDATE()`,
      ),
    );

  if (Number(rows[0]?.count ?? 0) > 0) {
    throw new CheckinValidationError('今日已在该景点打卡');
  }
}

export async function validateCheckInGeofence(input: {
  userId: number;
  userLatitude: number;
  userLongitude: number;
  gpsAccuracy?: number;
  attractionId?: number;
  targetLatitude?: number;
  targetLongitude?: number;
}) {
  const user: GeoPoint = {
    latitude: input.userLatitude,
    longitude: input.userLongitude,
  };

  if (!isCheckinGeofenceEnabled()) {
    return null;
  }

  assertGpsAccuracy(input.gpsAccuracy);

  const target = await resolveTargetPoint({
    attractionId: input.attractionId,
    targetLatitude: input.targetLatitude,
    targetLongitude: input.targetLongitude,
  });

  const distanceM = assertWithinGeofence(user, target);
  await assertReasonableTravelSpeed(input.userId, user);

  return distanceM;
}

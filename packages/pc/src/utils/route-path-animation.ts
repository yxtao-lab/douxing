import type { LatLng } from '@douxing/shared';

export type RoutePathAnimationOptions = {
  fullPoints: LatLng[];
  durationMs: number;
  onPolylineUpdate: (points: LatLng[]) => void;
  onMarkerUpdate: (point: LatLng) => void;
  onComplete?: () => void;
};

export type RoutePathAnimationController = {
  play: () => void;
  pause: () => void;
  restart: () => void;
  destroy: () => void;
  isPlaying: () => boolean;
};

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

type FrameHandle = ReturnType<typeof setTimeout>;

function scheduleFrame(callback: () => void): FrameHandle {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback) as unknown as FrameHandle;
  }
  return setTimeout(callback, 16);
}

function cancelFrame(handle: FrameHandle) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle as unknown as number);
    return;
  }
  clearTimeout(handle);
}

function interpolatePoint(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function pointAtProgress(fullPoints: LatLng[], progress: number): LatLng {
  if (fullPoints.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  if (fullPoints.length === 1 || progress <= 0) {
    return fullPoints[0]!;
  }
  if (progress >= 1) {
    return fullPoints[fullPoints.length - 1]!;
  }

  const total = fullPoints.length - 1;
  const pos = progress * total;
  const idx = Math.floor(pos);
  const frac = pos - idx;
  const a = fullPoints[idx]!;
  const b = fullPoints[Math.min(idx + 1, total)]!;
  return interpolatePoint(a, b, frac);
}

export function createRoutePathAnimation(
  options: RoutePathAnimationOptions,
): RoutePathAnimationController {
  let frameId: FrameHandle | null = null;
  let startAt = 0;
  let pausedElapsed = 0;
  let playing = false;
  const { fullPoints } = options;

  function emitFrame(elapsed: number) {
    const progress = Math.min(1, elapsed / options.durationMs);
    const visibleCount = Math.max(2, Math.ceil(fullPoints.length * progress));
    options.onPolylineUpdate(fullPoints.slice(0, visibleCount));
    options.onMarkerUpdate(pointAtProgress(fullPoints, progress));
    if (progress >= 1) {
      playing = false;
      options.onComplete?.();
    }
  }

  function tick() {
    if (!playing) return;
    const elapsed = nowMs() - startAt;
    emitFrame(elapsed);
    if (playing) {
      frameId = scheduleFrame(tick);
    }
  }

  function cancelScheduledFrame() {
    if (frameId != null) {
      cancelFrame(frameId);
      frameId = null;
    }
  }

  function resetVisual() {
    if (fullPoints.length === 0) return;
    options.onPolylineUpdate([fullPoints[0]!]);
    options.onMarkerUpdate(fullPoints[0]!);
  }

  return {
    play() {
      if (playing || fullPoints.length < 2) return;
      playing = true;
      startAt = nowMs() - pausedElapsed;
      frameId = scheduleFrame(tick);
    },
    pause() {
      if (!playing) return;
      playing = false;
      pausedElapsed = nowMs() - startAt;
      cancelScheduledFrame();
    },
    restart() {
      cancelScheduledFrame();
      playing = false;
      pausedElapsed = 0;
      resetVisual();
      this.play();
    },
    destroy() {
      cancelScheduledFrame();
      playing = false;
    },
    isPlaying() {
      return playing;
    },
  };
}

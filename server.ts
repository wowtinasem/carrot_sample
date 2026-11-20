import 'dotenv/config';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import {
  authenticateStaff,
  getCampaignById,
  getCustomerCouponForSession,
  getMenuItems,
  getStaffMetrics,
  getStaffUserById,
  getStoreInfo,
  issueOrGetCoupon,
  listRecentCouponsForStaff,
  LIVE_CAMPAIGN_ID,
  lookupCouponForStaff,
  redeemCouponAtomically,
  resolveEffectiveCampaign,
  saveMenuPrices,
  saveStoreInfo,
  updateLiveCampaignSettings,
} from './server/db.ts';
import type {
  EditableCampaignSettings,
  StaffUser,
  StorePlaceDetails,
} from './src/shared/types.ts';

function resolveKakaoAppKey(): string {
  return (
    process.env.VITE_KAKAO_MAP_APPKEY ||
    process.env.KAKAO_MAP_APPKEY ||
    ''
  ).trim();
}

function resolveKakaoRestKey(): string {
  return (process.env.KAKAO_REST_API_KEY || '').trim();
}

const placeLookupCache = new Map<
  string,
  { place: StorePlaceDetails; cachedAt: number }
>();
const PLACE_CACHE_TTL_MS = 10 * 60 * 1000;

const KNOWN_STORE_LOCATIONS: Array<{
  keywords: string[];
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}> = [
  {
    keywords: ['소노벨 영덕', '소노벨영덕', '파나크 영덕'],
    placeId: 'sonobelle-yeongdeok',
    displayName: '소노벨 영덕 (파나크 영덕)',
    formattedAddress: '경상북도 영덕군 강구면 해상공원길 200 (삼사리 191)',
    lat: 36.348132,
    lng: 129.3863104,
  },
];

function buildKakaoLinks(
  label: string,
  lat: number | null,
  lng: number | null,
  fallbackQuery: string,
): { kakaoMapUri: string; directionsUri: string } {
  const encodedLabel = encodeURIComponent(label);
  const encodedQuery = encodeURIComponent(fallbackQuery);
  if (lat !== null && lng !== null) {
    return {
      kakaoMapUri: `https://map.kakao.com/link/map/${encodedLabel},${lat},${lng}`,
      directionsUri: `https://map.kakao.com/link/to/${encodedLabel},${lat},${lng}`,
    };
  }
  return {
    kakaoMapUri: `https://map.kakao.com/link/search/${encodedQuery}`,
    directionsUri: `https://map.kakao.com/link/search/${encodedQuery}`,
  };
}

function resolvePort(): number {
  const portIdx = process.argv.findIndex((a) => a === '--port' || a === '-p');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const parsed = Number(process.argv[portIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const eqArg = process.argv.find((a) => a.startsWith('--port='));
  if (eqArg) {
    const parsed = Number(eqArg.slice('--port='.length));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    const parsed = Number(process.env.PORT);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const PORT = resolvePort();
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'iconcafe-dev-session-secret-key';

const CUSTOMER_COOKIE_NAME = 'ic_sid';
const STAFF_COOKIE_NAME = 'ic_staff';

function signValue(value: string): string {
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(value)
    .digest('base64url');
  return `${value}.${sig}`;
}

function verifySignedValue(token: string | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = token.slice(0, idx);
  const expected = signValue(value);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return value;
}

function setSessionCookie(
  res: Response,
  req: Request,
  name: string,
  signedToken: string,
  maxAgeMs: number,
): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(name, signedToken, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: maxAgeMs,
  });
}

// Sliding-window in-memory rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number, keyPrefix: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      res.status(429).json({
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}

function isPreviewRequest(req: Request): boolean {
  if (req.query.mode === 'public') return false;
  if (req.query.preview === 'test') return true;
  if (process.env.PUBLIC_COUPON_MODE === 'public') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  const host = (req.headers.host || '').toLowerCase();
  return host.includes('localhost') || host.includes('ais-dev-');
}

function getOrCreateCustomerSession(req: Request, res: Response): {
  sessionId: string;
  signedToken: string;
} {
  const fromCookie = verifySignedValue(req.cookies?.[CUSTOMER_COOKIE_NAME]);
  const fromHeader = verifySignedValue(
    req.headers['x-icon-session'] as string | undefined,
  );
  const existingId = fromCookie || fromHeader;
  if (existingId) {
    const signedToken = signValue(existingId);
    if (!fromCookie) {
      setSessionCookie(
        res,
        req,
        CUSTOMER_COOKIE_NAME,
        signedToken,
        180 * 24 * 60 * 60 * 1000,
      );
    }
    return { sessionId: existingId, signedToken };
  }

  const newId = crypto.randomUUID();
  const signedToken = signValue(newId);
  setSessionCookie(
    res,
    req,
    CUSTOMER_COOKIE_NAME,
    signedToken,
    180 * 24 * 60 * 60 * 1000,
  );
  return { sessionId: newId, signedToken };
}

function getExistingCustomerSession(req: Request): string | null {
  const fromCookie = verifySignedValue(req.cookies?.[CUSTOMER_COOKIE_NAME]);
  const fromHeader = verifySignedValue(
    req.headers['x-icon-session'] as string | undefined,
  );
  return fromCookie || fromHeader;
}

interface StaffRequest extends Request {
  staffUser?: StaffUser;
}

function requireStaffAuth(
  req: StaffRequest,
  res: Response,
  next: NextFunction,
): void {
  const staffId = verifySignedValue(req.cookies?.[STAFF_COOKIE_NAME]);
  if (!staffId) {
    res.status(401).json({
      error: '직원 로그인이 필요합니다.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  const staffUser = getStaffUserById(staffId);
  if (!staffUser) {
    res.status(401).json({
      error: '유효하지 않은 직원 세션입니다. 다시 로그인해 주세요.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  req.staffUser = staffUser;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());

  // Prevent browser/CDN caching on API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 1. Public store, menu & campaign config
  app.get('/api/config', rateLimit(120, 60_000, 'pub-config'), (req, res) => {
    const forcePublic = req.query.mode === 'public';
    const allowPreviewTest = isPreviewRequest(req);
    const { campaign, availability, isPreviewTestMode } =
      resolveEffectiveCampaign({
        allowPreviewTest,
        forcePublicMode: forcePublic,
      });

    const kakaoMapAppKey = resolveKakaoAppKey();
    res.json({
      store: getStoreInfo(),
      menu: getMenuItems(),
      campaign,
      availability,
      isPreviewTestMode,
      ...(kakaoMapAppKey ? { kakaoMapAppKey } : {}),
      serverNow: new Date().toISOString(),
    });
  });

  // 1b. Store place resolution for Kakao Map (Kakao Local API when key is set, with verified fallback)
  app.get('/api/store/place', rateLimit(60, 60_000, 'pub-place'), async (_req, res) => {
    const store = getStoreInfo();
    const query = (store.address || '소노벨 영덕').trim();
    const brandName = (store.brandName || '당근카페').trim();
    const linkLabel = `${brandName} (${query})`;

    const cached = placeLookupCache.get(`${brandName}:${query}`);
    if (cached && Date.now() - cached.cachedAt < PLACE_CACHE_TTL_MS) {
      res.json({ place: cached.place });
      return;
    }

    const kakaoRestKey = resolveKakaoRestKey();
    if (kakaoRestKey) {
      try {
        const response = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
          {
            headers: {
              Authorization: `KakaoAK ${kakaoRestKey}`,
            },
          },
        );
        if (response.ok) {
          const data = (await response.json()) as {
            documents?: Array<{
              id?: string;
              place_name?: string;
              road_address_name?: string;
              address_name?: string;
              x?: string;
              y?: string;
            }>;
          };
          const first = data.documents?.[0];
          const lat = first?.y ? Number(first.y) : NaN;
          const lng = first?.x ? Number(first.x) : NaN;
          if (first && Number.isFinite(lat) && Number.isFinite(lng)) {
            const links = buildKakaoLinks(linkLabel, lat, lng, query);
            const place: StorePlaceDetails = {
              placeId: first.id || '',
              displayName: first.place_name || query,
              formattedAddress: first.road_address_name || first.address_name || query,
              location: { lat, lng },
              kakaoMapUri: first.id
                ? `https://map.kakao.com/link/map/${first.id}`
                : links.kakaoMapUri,
              directionsUri: first.id
                ? `https://map.kakao.com/link/to/${first.id}`
                : links.directionsUri,
            };
            placeLookupCache.set(`${brandName}:${query}`, {
              place,
              cachedAt: Date.now(),
            });
            res.json({ place });
            return;
          }
        }
      } catch (err) {
        console.error('Kakao Local keyword search error:', err);
      }
    }

    const normalized = query.replace(/\s+/g, '').toLowerCase();
    const known = KNOWN_STORE_LOCATIONS.find((entry) =>
      entry.keywords.some((kw) => normalized.includes(kw.replace(/\s+/g, '').toLowerCase())),
    );

    if (known) {
      const links = buildKakaoLinks(linkLabel, known.lat, known.lng, query);
      const place: StorePlaceDetails = {
        placeId: known.placeId,
        displayName: known.displayName,
        formattedAddress: known.formattedAddress,
        location: { lat: known.lat, lng: known.lng },
        ...links,
      };
      placeLookupCache.set(`${brandName}:${query}`, {
        place,
        cachedAt: Date.now(),
      });
      res.json({ place });
      return;
    }

    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&accept-language=ko&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'CarrotCafeApp/1.0' } },
      );
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as Array<{
          lat?: string;
          lon?: string;
          display_name?: string;
        }>;
        const hit = nomData[0];
        const lat = hit?.lat ? Number(hit.lat) : NaN;
        const lng = hit?.lon ? Number(hit.lon) : NaN;
        if (hit && Number.isFinite(lat) && Number.isFinite(lng)) {
          const links = buildKakaoLinks(linkLabel, lat, lng, query);
          const place: StorePlaceDetails = {
            placeId: '',
            displayName: query,
            formattedAddress: hit.display_name || query,
            location: { lat, lng },
            ...links,
          };
          placeLookupCache.set(`${brandName}:${query}`, {
            place,
            cachedAt: Date.now(),
          });
          res.json({ place });
          return;
        }
      }
    } catch {
      // Ignore geocoding fallback error
    }

    const fallbackLinks = buildKakaoLinks(linkLabel, null, null, query);
    res.json({
      place: {
        placeId: '',
        displayName: query,
        formattedAddress: query,
        location: null,
        ...fallbackLinks,
      } satisfies StorePlaceDetails,
    });
  });

  // 2. Customer: get current session's coupon status
  app.get('/api/coupons/me', rateLimit(90, 60_000, 'pub-me'), (req, res) => {
    const sessionId = getExistingCustomerSession(req);
    const forcePublic = req.query.mode === 'public';
    const allowPreviewTest = isPreviewRequest(req);
    const { campaign } = resolveEffectiveCampaign({
      allowPreviewTest,
      forcePublicMode: forcePublic,
    });

    if (!sessionId || !campaign) {
      res.json({ coupon: null, serverNow: new Date().toISOString() });
      return;
    }

    const coupon = getCustomerCouponForSession({
      campaignId: campaign.id,
      sessionId,
    });

    res.json({ coupon, serverNow: new Date().toISOString() });
  });

  // 3. Customer: issue or return existing coupon idempotently
  app.post('/api/coupons/issue', rateLimit(30, 60_000, 'pub-issue'), (req, res) => {
    const forcePublic = req.query.mode === 'public' || req.body?.mode === 'public';
    const allowPreviewTest =
      req.query.preview === 'test' ||
      req.body?.preview === 'test' ||
      isPreviewRequest(req);

    const { campaign, availability } = resolveEffectiveCampaign({
      allowPreviewTest,
      forcePublicMode: forcePublic,
    });

    if (!campaign || availability !== 'ready') {
      const messages: Record<string, string> = {
        preparing: '현재 쿠폰 행사를 준비 중입니다.',
        upcoming: '쿠폰 발급 시작 전입니다.',
        paused: '쿠폰 발급이 일시 중단되었습니다.',
        ended: '쿠폰 행사가 종료되었습니다.',
      };
      res.status(409).json({
        error: messages[availability] || '현재 쿠폰을 발급할 수 없습니다.',
        availability,
      });
      return;
    }

    const { sessionId, signedToken } = getOrCreateCustomerSession(req, res);
    const { coupon, created } = issueOrGetCoupon({ campaign, sessionId });

    res.status(created ? 201 : 200).json({
      coupon,
      sessionToken: signedToken,
      serverNow: new Date().toISOString(),
    });
  });

  // 4. Staff auth endpoints
  app.post('/api/staff/login', rateLimit(20, 60_000, 'staff-login'), (req, res) => {
    const staffId = String(req.body?.staffId || '');
    const pin = String(req.body?.pin || '');
    const user = authenticateStaff(staffId, pin);
    if (!user) {
      res.status(401).json({
        error: '직원 ID 또는 비밀번호가 올바르지 않습니다.',
      });
      return;
    }
    const token = signValue(user.id);
    setSessionCookie(res, req, STAFF_COOKIE_NAME, token, 12 * 60 * 60 * 1000);
    res.json({ user });
  });

  app.post('/api/staff/logout', (req, res) => {
    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie(STAFF_COOKIE_NAME, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      path: '/',
    });
    res.json({ ok: true });
  });

  app.get('/api/staff/me', requireStaffAuth, (req: StaffRequest, res) => {
    res.json({ user: req.staffUser });
  });

  // 5. Staff coupon lookup (read-only)
  app.get(
    '/api/staff/coupons/:code',
    requireStaffAuth,
    rateLimit(120, 60_000, 'staff-lookup'),
    (req, res) => {
      const codeParam = String(req.params.code || '');
      const coupon = lookupCouponForStaff(codeParam);
      if (!coupon) {
        res.status(404).json({
          error: '등록되지 않은 쿠폰 번호입니다.',
          code: 'NOT_FOUND',
        });
        return;
      }
      res.json({ coupon, serverNow: new Date().toISOString() });
    },
  );

  // 6. Staff atomic redemption
  app.post(
    '/api/staff/coupons/:code/redeem',
    requireStaffAuth,
    rateLimit(60, 60_000, 'staff-redeem'),
    (req: StaffRequest, res) => {
      const codeParam = String(req.params.code || '');
      const result = redeemCouponAtomically(codeParam, req.staffUser!.id);
      if (!result.ok) {
        const statusMap = {
          NOT_FOUND: 404,
          ALREADY_USED: 409,
          EXPIRED: 410,
        };
        res.status(statusMap[result.reason]).json({
          error: result.message,
          reason: result.reason,
          coupon: result.coupon ?? null,
          serverNow: new Date().toISOString(),
        });
        return;
      }

      res.json({
        coupon: result.coupon,
        serverNow: new Date().toISOString(),
      });
    },
  );

  // 7. Staff metrics & list
  app.get('/api/staff/metrics', requireStaffAuth, (req, res) => {
    const includeTest = req.query.includeTest === '1';
    res.json({
      metrics: getStaffMetrics(),
      recentCoupons: listRecentCouponsForStaff(includeTest),
      liveCampaign: getCampaignById(LIVE_CAMPAIGN_ID),
      store: getStoreInfo(),
      menu: getMenuItems(),
      serverNow: new Date().toISOString(),
    });
  });

  // 8. Staff settings update (store info, menu prices, live campaign dates)
  app.put('/api/staff/settings', requireStaffAuth, (req, res) => {
    const body = req.body || {};
    const store = body.store ? saveStoreInfo(body.store) : getStoreInfo();
    const menu = body.prices ? saveMenuPrices(body.prices) : getMenuItems();
    const liveCampaign = body.campaign
      ? updateLiveCampaignSettings(body.campaign as EditableCampaignSettings)
      : getCampaignById(LIVE_CAMPAIGN_ID);

    res.json({
      store,
      menu,
      liveCampaign,
      serverNow: new Date().toISOString(),
    });
  });

  const httpServer = http.createServer(app);

  // Static & Vite middleware setup
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`IconCafe server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

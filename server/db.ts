import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CampaignSummary,
  CouponStatus,
  CustomerCouponDTO,
  EditableCampaignSettings,
  MenuItemConfig,
  PublicCouponAvailability,
  StaffCouponRecord,
  StaffMetrics,
  StaffUser,
  StoreInfoConfig,
} from '../src/shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'iconcafe.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    benefit_text TEXT NOT NULL,
    condition_text TEXT NOT NULL,
    issue_start_at TEXT,
    issue_end_at TEXT,
    redeem_end_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    is_test INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unused',
    is_test INTEGER NOT NULL DEFAULT 0,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_by TEXT,
    UNIQUE(campaign_id, session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
  CREATE INDEX IF NOT EXISTS idx_coupons_campaign_test ON coupons(campaign_id, is_test, status);

  CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    pin_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export const LIVE_CAMPAIGN_ID = 'carrot-cake-launch-2026';
export const TEST_CAMPAIGN_ID = 'carrot-cake-launch-2026-test';

const DEFAULT_STORE_INFO: StoreInfoConfig = {
  brandName: '당근카페',
  address: '소노벨 영덕',
  hours: '',
  mapUrl: '',
  phone: '010-0000-0000',
  youtubeUrl: 'https://www.youtube.com',
};

const DEFAULT_MENU_ITEMS: MenuItemConfig[] = [
  {
    id: 'carrot-cake',
    category: 'signature',
    name: '유기농 당근케이크',
    description:
      '제주 구좌 유기농 당근과 달콤한 과일, 고소한 호두를 넣어 촉촉하게 구워낸 당근카페 시그니처 케이크예요.',
    image: '/images/menu/carrot-cake.webp',
    price: 6800,
  },
  {
    id: 'americano',
    category: 'coffee',
    name: '아메리카노',
    description:
      '볶은 아몬드와 다크 초콜릿의 고소한 풍미가 살아있어 당근케이크와 가장 잘 어울리는 하우스 블렌드 커피예요.',
    image: '/images/menu/americano.webp',
    price: 4500,
  },
  {
    id: 'cafe-latte',
    category: 'coffee',
    name: '카페라테',
    description:
      '진하게 내린 에스프레소에 부드럽고 달큰한 스팀 밀크를 넉넉히 담아 고소하고 포근한 맛을 느낄 수 있어요.',
    image: '/images/menu/cafe-latte.webp',
    price: 5000,
  },
  {
    id: 'vanilla-latte',
    category: 'coffee',
    name: '바닐라라테',
    description:
      '천연 바닐라빈을 듬뿍 우려낸 수제 바닐라 시럽을 더해 인위적이지 않고 은은하게 달콤한 라테예요.',
    image: '/images/menu/vanilla-latte.webp',
    price: 5500,
  },
  {
    id: 'cappuccino',
    category: 'coffee',
    name: '카푸치노',
    description:
      '벨벳처럼 폭신하고 쫀쫀한 우유 거품 위에 향긋한 시나몬 가루를 톡톡 올려 따뜻하게 즐기는 클래식 커피예요.',
    image: '/images/menu/cappuccino.webp',
    price: 5000,
  },
  {
    id: 'chocolate-latte',
    category: 'non-coffee',
    name: '초코라테',
    description:
      '진한 벨기에산 다크 코코아를 우유에 부드럽게 녹여내어 남녀노소 누구나 기분 좋게 즐기는 달콤한 라테예요.',
    image: '/images/menu/chocolate-latte.webp',
    price: 5500,
  },
  {
    id: 'matcha-latte',
    category: 'non-coffee',
    name: '말차라테',
    description:
      '제주산 1등급 유기농 어린잎 말차의 깔끔하고 진한 쌉싸름함에 부드러운 우유를 더한 초록빛 라테예요.',
    image: '/images/menu/matcha-latte.webp',
    price: 5800,
  },
  {
    id: 'grapefruit-ade',
    category: 'non-coffee',
    name: '자몽에이드',
    description:
      '알알이 과육이 살아있는 수제 자몽청과 톡 쏘는 탄산수가 만나 입안을 상큼하게 깨워주는 과일 에이드예요.',
    image: '/images/menu/grapefruit-ade.webp',
    price: 5800,
  },
  {
    id: 'chamomile-tea',
    category: 'non-coffee',
    name: '캐모마일티',
    description:
      '향긋한 사과 꽃향이 은은하게 퍼져 마음을 포근하게 달래주는 카페인 프리 허브티예요.',
    image: '/images/menu/chamomile-tea.webp',
    price: 4800,
  },
];

function hashPin(staffId: string, pin: string): string {
  return crypto
    .createHash('sha256')
    .update(`iconcafe:${staffId}:${pin}`)
    .digest('hex');
}

function seedInitialData(): void {
  const upsertCampaign = db.prepare(`
    INSERT OR IGNORE INTO campaigns (
      id, title, benefit_text, condition_text,
      issue_start_at, issue_end_at, redeem_end_at, status, is_test
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  upsertCampaign.run(
    LIVE_CAMPAIGN_ID,
    '유기농 당근케이크 출시 첫 방문 프로모션',
    '유기농 당근케이크 구매 시 아메리카노 1잔 무료',
    '당근카페 첫 방문 고객 대상 · 유기농 당근케이크 구매 시 1인 1회 사용',
    null,
    null,
    null,
    'draft',
    0,
  );

  const now = new Date();
  const testStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const testEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const testRedeemEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString();

  upsertCampaign.run(
    TEST_CAMPAIGN_ID,
    '신메뉴 테스트 행사 (통계 제외)',
    '유기농 당근케이크 구매 시 아메리카노 1잔 무료',
    '당근카페 첫 방문 고객 대상 · 유기농 당근케이크 구매 시 1인 1회 사용',
    testStart,
    testEnd,
    testRedeemEnd,
    'active',
    1,
  );

  const staffPass = process.env.STAFF_DEFAULT_PASSCODE || 'icon2026';
  const adminPass = process.env.ADMIN_DEFAULT_PASSCODE || 'admin2026';

  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff_users (id, name, role, pin_hash)
    VALUES (?, ?, ?, ?)
  `);
  insertStaff.run('staff1', '카운터 직원', 'staff', hashPin('staff1', staffPass));
  insertStaff.run('manager', '매장 관리자', 'admin', hashPin('manager', adminPass));

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('store_info', JSON.stringify(DEFAULT_STORE_INFO));
  insertSetting.run('menu_items', JSON.stringify(DEFAULT_MENU_ITEMS));

  // Migrate existing menu_items missing descriptions / initial virtual prices
  const existingMenuRow = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('menu_items') as { value: string } | undefined;
  if (existingMenuRow) {
    try {
      const parsedMenu = JSON.parse(existingMenuRow.value) as MenuItemConfig[];
      if (Array.isArray(parsedMenu)) {
        const defaultById = new Map(DEFAULT_MENU_ITEMS.map((item) => [item.id, item]));
        const needsBackfill = parsedMenu.some(
          (item) => item.category !== 'signature' && !item.description,
        );
        if (needsBackfill) {
          const updatedMenu = parsedMenu.map((item) => {
            const def = defaultById.get(item.id);
            if (!def) return item;
            return {
              ...item,
              description: item.description || def.description,
              price: item.price ?? def.price,
            };
          });
          db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(
            'menu_items',
            JSON.stringify(updatedMenu),
          );
        }
      }
    } catch {
      // Ignore malformed menu_items JSON
    }
  }

  // Migrate existing default brand name & address
  const existingStoreRow = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get('store_info') as { value: string } | undefined;
  if (existingStoreRow) {
    try {
      const parsed = JSON.parse(existingStoreRow.value) as Partial<StoreInfoConfig>;
      let changed = false;
      if (parsed.brandName === '아이콘카페') {
        parsed.brandName = '당근카페';
        changed = true;
      }
      if (parsed.address === '계원예술대학교 평생교육원 내 구내카페') {
        parsed.address = '소노벨 영덕';
        changed = true;
      }
      if (changed) {
        db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(
          'store_info',
          JSON.stringify(parsed),
        );
      }
    } catch {
      // Ignore malformed store_info JSON
    }
  }

  db.prepare(`
    UPDATE campaigns
    SET condition_text = REPLACE(condition_text, '아이콘카페', '당근카페')
    WHERE condition_text LIKE '%아이콘카페%'
  `).run();
}

seedInitialData();

interface CampaignRow {
  id: string;
  title: string;
  benefit_text: string;
  condition_text: string;
  issue_start_at: string | null;
  issue_end_at: string | null;
  redeem_end_at: string | null;
  status: 'draft' | 'active' | 'paused' | 'ended';
  is_test: number;
}

interface CouponRow {
  id: number;
  campaign_id: string;
  code: string;
  session_id: string;
  status: string;
  is_test: number;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

function mapCampaign(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    title: row.title,
    benefitText: row.benefit_text,
    conditionText: row.condition_text,
    issueStartAt: row.issue_start_at,
    issueEndAt: row.issue_end_at,
    redeemEndAt: row.redeem_end_at,
    status: row.status,
    isTest: Boolean(row.is_test),
  };
}

function computeCouponStatus(row: CouponRow, nowMs: number): CouponStatus {
  if (row.status === 'used') return 'used';
  const expMs = Date.parse(row.expires_at);
  if (!Number.isNaN(expMs) && nowMs > expMs) {
    return 'expired';
  }
  return 'unused';
}

function toCustomerDTO(row: CouponRow, campaign: CampaignSummary, nowMs: number): CustomerCouponDTO {
  return {
    code: row.code,
    campaignId: row.campaign_id,
    benefitText: campaign.benefitText,
    conditionText: campaign.conditionText,
    status: computeCouponStatus(row, nowMs),
    isTest: Boolean(row.is_test),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

export function getStoreInfo(): StoreInfoConfig {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('store_info') as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_STORE_INFO;
  try {
    return { ...DEFAULT_STORE_INFO, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_STORE_INFO;
  }
}

export function saveStoreInfo(next: Partial<StoreInfoConfig>): StoreInfoConfig {
  const current = getStoreInfo();
  const updated: StoreInfoConfig = {
    brandName: (next.brandName ?? current.brandName).trim() || '당근카페',
    address: (next.address ?? current.address).trim(),
    hours: (next.hours ?? current.hours).trim(),
    mapUrl: (next.mapUrl ?? current.mapUrl).trim(),
    phone: (next.phone ?? current.phone).trim(),
    youtubeUrl: (next.youtubeUrl ?? current.youtubeUrl).trim(),
  };
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(
    'store_info',
    JSON.stringify(updated),
  );
  return updated;
}

export function getMenuItems(): MenuItemConfig[] {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('menu_items') as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_MENU_ITEMS;
  try {
    const parsed = JSON.parse(row.value) as MenuItemConfig[];
    return Array.isArray(parsed) && parsed.length === DEFAULT_MENU_ITEMS.length
      ? parsed
      : DEFAULT_MENU_ITEMS;
  } catch {
    return DEFAULT_MENU_ITEMS;
  }
}

export function saveMenuPrices(prices: Record<string, number | null>): MenuItemConfig[] {
  const items = getMenuItems();
  const updated = items.map((item) => {
    if (!(item.id in prices)) return item;
    const raw = prices[item.id];
    const cleanPrice =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
    return { ...item, price: cleanPrice };
  });
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(
    'menu_items',
    JSON.stringify(updated),
  );
  return updated;
}

export function getCampaignById(id: string): CampaignSummary | null {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as CampaignRow | undefined;
  return row ? mapCampaign(row) : null;
}

export function updateLiveCampaignSettings(
  settings: EditableCampaignSettings,
): CampaignSummary {
  const toIsoOrNull = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const issueStartAt = toIsoOrNull(settings.liveIssueStartAt);
  const issueEndAt = toIsoOrNull(settings.liveIssueEndAt);
  const redeemEndAt = toIsoOrNull(settings.liveRedeemEndAt);
  const allowedStatus = ['draft', 'active', 'paused', 'ended'].includes(settings.liveStatus)
    ? settings.liveStatus
    : 'draft';

  db.prepare(`
    UPDATE campaigns
    SET issue_start_at = ?, issue_end_at = ?, redeem_end_at = ?, status = ?
    WHERE id = ?
  `).run(issueStartAt, issueEndAt, redeemEndAt, allowedStatus, LIVE_CAMPAIGN_ID);

  return getCampaignById(LIVE_CAMPAIGN_ID)!;
}

export function resolveEffectiveCampaign(options: {
  allowPreviewTest: boolean;
  forcePublicMode?: boolean;
}): {
  campaign: CampaignSummary | null;
  availability: PublicCouponAvailability;
  isPreviewTestMode: boolean;
} {
  const live = getCampaignById(LIVE_CAMPAIGN_ID);
  const nowMs = Date.now();

  const liveHasDates = Boolean(
    live && live.issueStartAt && live.issueEndAt && live.redeemEndAt,
  );

  if (live && liveHasDates && live.status !== 'draft') {
    if (live.status === 'paused') {
      return { campaign: live, availability: 'paused', isPreviewTestMode: false };
    }
    if (live.status === 'ended') {
      return { campaign: live, availability: 'ended', isPreviewTestMode: false };
    }

    const startMs = Date.parse(live.issueStartAt!);
    const endMs = Date.parse(live.issueEndAt!);
    const redeemEndMs = Date.parse(live.redeemEndAt!);

    if (nowMs < startMs) {
      return { campaign: live, availability: 'upcoming', isPreviewTestMode: false };
    }
    if (nowMs > endMs || nowMs > redeemEndMs) {
      return { campaign: live, availability: 'ended', isPreviewTestMode: false };
    }
    return { campaign: live, availability: 'ready', isPreviewTestMode: false };
  }

  // Live campaign dates are not confirmed/activated yet:
  // PRD: "행사 날짜가 비어 있으면 미리보기에서만 테스트 쿠폰을 사용하고 공개 화면에는 쿠폰 준비 중을 표시한다."
  if (options.allowPreviewTest && !options.forcePublicMode) {
    const testCamp = getCampaignById(TEST_CAMPAIGN_ID);
    if (testCamp && testCamp.status === 'active') {
      return { campaign: testCamp, availability: 'ready', isPreviewTestMode: true };
    }
  }

  return { campaign: live, availability: 'preparing', isPreviewTestMode: false };
}

// Unambiguous uppercase alphabet (excludes 0/O, 1/I/L for manual counter entry & barcode readability)
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateCouponCode(isTest: boolean): string {
  const prefix = isTest ? 'ICT' : 'IC';
  const bytes = crypto.randomBytes(10);
  let body = '';
  for (let i = 0; i < 10; i++) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${prefix}${body}`;
}

export function issueOrGetCoupon(params: {
  campaign: CampaignSummary;
  sessionId: string;
}): { coupon: CustomerCouponDTO; created: boolean } {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const txn = db.transaction((): { row: CouponRow; created: boolean } => {
    const existing = db
      .prepare('SELECT * FROM coupons WHERE campaign_id = ? AND session_id = ?')
      .get(params.campaign.id, params.sessionId) as CouponRow | undefined;

    if (existing) {
      return { row: existing, created: false };
    }

    const expiresAt =
      params.campaign.redeemEndAt ||
      new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCouponCode(params.campaign.isTest);
      try {
        db.prepare(`
          INSERT INTO coupons (
            campaign_id, code, session_id, status, is_test, issued_at, expires_at
          ) VALUES (?, ?, ?, 'unused', ?, ?, ?)
        `).run(
          params.campaign.id,
          code,
          params.sessionId,
          params.campaign.isTest ? 1 : 0,
          nowIso,
          expiresAt,
        );
        const inserted = db
          .prepare('SELECT * FROM coupons WHERE campaign_id = ? AND session_id = ?')
          .get(params.campaign.id, params.sessionId) as CouponRow;
        return { row: inserted, created: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('UNIQUE constraint failed: coupons.campaign_id, coupons.session_id')) {
          const raced = db
            .prepare('SELECT * FROM coupons WHERE campaign_id = ? AND session_id = ?')
            .get(params.campaign.id, params.sessionId) as CouponRow;
          return { row: raced, created: false };
        }
        // Retry if random code collision
      }
    }
    throw new Error('Failed to generate unique coupon code');
  });

  const { row, created } = txn();
  return {
    coupon: toCustomerDTO(row, params.campaign, nowMs),
    created,
  };
}

export function getCustomerCouponForSession(params: {
  campaignId: string;
  sessionId: string;
}): CustomerCouponDTO | null {
  const row = db
    .prepare('SELECT * FROM coupons WHERE campaign_id = ? AND session_id = ?')
    .get(params.campaignId, params.sessionId) as CouponRow | undefined;

  if (!row) return null;
  const campaign = getCampaignById(row.campaign_id);
  if (!campaign) return null;
  return toCustomerDTO(row, campaign, Date.now());
}

export function authenticateStaff(staffId: string, pin: string): StaffUser | null {
  const cleanId = staffId.trim();
  const cleanPin = pin.trim();
  if (!cleanId || !cleanPin) return null;

  const row = db
    .prepare('SELECT id, name, role, pin_hash FROM staff_users WHERE id = ?')
    .get(cleanId) as
    | { id: string; name: string; role: 'staff' | 'admin'; pin_hash: string }
    | undefined;

  if (!row) return null;
  const candidateHash = hashPin(cleanId, cleanPin);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(row.pin_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return { id: row.id, name: row.name, role: row.role };
}

export function getStaffUserById(id: string): StaffUser | null {
  const row = db
    .prepare('SELECT id, name, role FROM staff_users WHERE id = ?')
    .get(id) as StaffUser | undefined;
  return row ?? null;
}

export function normalizeCouponCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

function toStaffRecord(row: CouponRow, nowMs: number): StaffCouponRecord {
  const campaign = getCampaignById(row.campaign_id);
  const staff = row.used_by ? getStaffUserById(row.used_by) : null;
  return {
    code: row.code,
    campaignId: row.campaign_id,
    benefitText:
      campaign?.benefitText ?? '유기농 당근케이크 구매 시 아메리카노 1잔 무료',
    conditionText:
      campaign?.conditionText ??
      '당근카페 첫 방문 고객 대상 · 유기농 당근케이크 구매 시 1인 1회 사용',
    status: computeCouponStatus(row, nowMs),
    isTest: Boolean(row.is_test),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
    usedByName: staff?.name ?? row.used_by,
  };
}

export function lookupCouponForStaff(rawCode: string): StaffCouponRecord | null {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) as
    | CouponRow
    | undefined;
  if (!row) return null;
  return toStaffRecord(row, Date.now());
}

export type RedeemResult =
  | { ok: true; coupon: StaffCouponRecord }
  | {
      ok: false;
      reason: 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED';
      message: string;
      coupon?: StaffCouponRecord;
    };

export function redeemCouponAtomically(rawCode: string, staffId: string): RedeemResult {
  const code = normalizeCouponCode(rawCode);
  if (!code) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      message: '올바른 쿠폰 번호를 입력해 주세요.',
    };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const txn = db.transaction((): RedeemResult => {
    const existing = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) as
      | CouponRow
      | undefined;

    if (!existing) {
      return {
        ok: false,
        reason: 'NOT_FOUND',
        message: '등록되지 않은 쿠폰 번호입니다.',
      };
    }

    if (existing.status === 'used') {
      return {
        ok: false,
        reason: 'ALREADY_USED',
        message: '이미 사용된 쿠폰입니다.',
        coupon: toStaffRecord(existing, nowMs),
      };
    }

    if (nowMs > Date.parse(existing.expires_at)) {
      return {
        ok: false,
        reason: 'EXPIRED',
        message: '유효기간이 만료된 쿠폰입니다.',
        coupon: toStaffRecord(existing, nowMs),
      };
    }

    const updateInfo = db
      .prepare(`
        UPDATE coupons
        SET status = 'used', used_at = ?, used_by = ?
        WHERE code = ? AND status = 'unused' AND expires_at > ?
      `)
      .run(nowIso, staffId, code, nowIso);

    if (updateInfo.changes === 1) {
      const updated = db
        .prepare('SELECT * FROM coupons WHERE code = ?')
        .get(code) as CouponRow;
      return { ok: true, coupon: toStaffRecord(updated, nowMs) };
    }

    const latest = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) as
      | CouponRow
      | undefined;
    if (!latest) {
      return {
        ok: false,
        reason: 'NOT_FOUND',
        message: '등록되지 않은 쿠폰 번호입니다.',
      };
    }
    if (latest.status === 'used') {
      return {
        ok: false,
        reason: 'ALREADY_USED',
        message: '이미 사용된 쿠폰입니다.',
        coupon: toStaffRecord(latest, nowMs),
      };
    }
    return {
      ok: false,
      reason: 'EXPIRED',
      message: '유효기간이 만료된 쿠폰입니다.',
      coupon: toStaffRecord(latest, nowMs),
    };
  });

  return txn();
}

export function getStaffMetrics(): StaffMetrics {
  const liveRow = db
    .prepare(`
      SELECT
        COUNT(*) AS issued_count,
        COALESCE(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END), 0) AS used_count
      FROM coupons
      WHERE is_test = 0
    `)
    .get() as { issued_count: number; used_count: number };

  const testRow = db
    .prepare(`
      SELECT
        COUNT(*) AS issued_count,
        COALESCE(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END), 0) AS used_count
      FROM coupons
      WHERE is_test = 1
    `)
    .get() as { issued_count: number; used_count: number };

  const issuedCount = liveRow.issued_count;
  const usedCount = liveRow.used_count;
  const redemptionRate =
    issuedCount > 0 ? Math.round((usedCount / issuedCount) * 1000) / 10 : 0;

  return {
    issuedCount,
    usedCount,
    redemptionRate,
    testIssuedCount: testRow.issued_count,
    testUsedCount: testRow.used_count,
  };
}

export function listRecentCouponsForStaff(includeTest: boolean): StaffCouponRecord[] {
  const nowMs = Date.now();
  const rows = (
    includeTest
      ? db.prepare('SELECT * FROM coupons ORDER BY id DESC LIMIT 50').all()
      : db
          .prepare('SELECT * FROM coupons WHERE is_test = 0 ORDER BY id DESC LIMIT 50')
          .all()
  ) as CouponRow[];

  return rows.map((r) => toStaffRecord(r, nowMs));
}

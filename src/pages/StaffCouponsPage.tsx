import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ScanBarcode,
  Settings,
  XCircle,
} from 'lucide-react';
import type {
  CampaignSummary,
  MenuItemConfig,
  StaffCouponRecord,
  StaffMetrics,
  StaffUser,
  StoreInfoConfig,
} from '../shared/types.ts';
import {
  formatKstDateTime,
  formatPriceKRW,
  kstInputToIso,
  toKstDateTimeLocalInput,
} from '../lib/formatters.ts';

interface StaffCouponsPageProps {
  onNavigate: (path: string) => void;
}

type StaffTab = 'redeem' | 'settings';

export function StaffCouponsPage({ onNavigate }: StaffCouponsPageProps) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<StaffTab>('redeem');
  const [metrics, setMetrics] = useState<StaffMetrics>({
    issuedCount: 0,
    usedCount: 0,
    redemptionRate: 0,
    testIssuedCount: 0,
    testUsedCount: 0,
  });
  const [recentCoupons, setRecentCoupons] = useState<StaffCouponRecord[]>([]);
  const [includeTestInList, setIncludeTestInList] = useState(true);

  const [codeInput, setCodeInput] = useState('');
  const [lookedUpCoupon, setLookedUpCoupon] = useState<StaffCouponRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{
    type: 'success' | 'error' | 'network';
    message: string;
    code?: string;
  } | null>(null);

  const [storeDraft, setStoreDraft] = useState<StoreInfoConfig>({
    brandName: '당근카페',
    address: '소노벨 영덕',
    hours: '',
    mapUrl: '',
    phone: '010-0000-0000',
    youtubeUrl: 'https://www.youtube.com',
  });
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [campaignDraft, setCampaignDraft] = useState<{
    liveIssueStartAt: string;
    liveIssueEndAt: string;
    liveRedeemEndAt: string;
    liveStatus: 'draft' | 'active' | 'paused' | 'ended';
  }>({
    liveIssueStartAt: '',
    liveIssueEndAt: '',
    liveRedeemEndAt: '',
    liveStatus: 'draft',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const loadDashboard = useCallback(
    async (withTest = includeTestInList) => {
      try {
        const res = await fetch(
          `/api/staff/metrics?includeTest=${withTest ? '1' : '0'}`,
          { credentials: 'include' },
        );
        if (res.status === 401) {
          setUser(null);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          metrics: StaffMetrics;
          recentCoupons: StaffCouponRecord[];
          liveCampaign: CampaignSummary | null;
          store: StoreInfoConfig;
          menu: MenuItemConfig[];
        };
        setMetrics(data.metrics);
        setRecentCoupons(data.recentCoupons);
        setStoreDraft(data.store);
        setMenuItems(data.menu);
        const drafts: Record<string, string> = {};
        for (const item of data.menu) {
          drafts[item.id] = item.price ? String(item.price) : '';
        }
        setPriceDrafts(drafts);
        if (data.liveCampaign) {
          setCampaignDraft({
            liveIssueStartAt: toKstDateTimeLocalInput(data.liveCampaign.issueStartAt),
            liveIssueEndAt: toKstDateTimeLocalInput(data.liveCampaign.issueEndAt),
            liveRedeemEndAt: toKstDateTimeLocalInput(data.liveCampaign.redeemEndAt),
            liveStatus: data.liveCampaign.status,
          });
        }
      } catch {
        // Handled on next action
      }
    },
    [includeTestInList],
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/staff/me', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { user: StaffUser };
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboard(includeTestInList);
    }
  }, [user, includeTestInList, loadDashboard]);

  useEffect(() => {
    if (user && activeTab === 'redeem') {
      scanInputRef.current?.focus();
    }
  }, [user, activeTab]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: loginId, pin: loginPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || '로그인에 실패했습니다.');
        return;
      }
      setUser(data.user);
      setLoginPin('');
    } catch {
      setLoginError('서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/staff/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
      setLookedUpCoupon(null);
      setRedeemFeedback(null);
    }
  };

  const lookupCode = async (rawCode: string) => {
    const cleaned = rawCode.trim();
    if (!cleaned) {
      setLookupError('바코드를 스캔하거나 쿠폰 번호를 입력해 주세요.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setRedeemFeedback(null);
    setLookedUpCoupon(null);

    try {
      const res = await fetch(
        `/api/staff/coupons/${encodeURIComponent(cleaned)}`,
        { credentials: 'include' },
      );
      if (res.status === 401) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || '쿠폰을 조회할 수 없습니다.');
        return;
      }
      setLookedUpCoupon(data.coupon);
    } catch {
      setLookupError(
        '통신 오류로 쿠폰 상태를 조회하지 못했습니다. 네트워크를 확인한 뒤 다시 조회해 주세요.',
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookupCode(codeInput);
  };

  const handleResetLookup = () => {
    setCodeInput('');
    setLookedUpCoupon(null);
    setLookupError(null);
    setRedeemFeedback(null);
    scanInputRef.current?.focus();
  };

  const handleRedeem = async () => {
    if (!lookedUpCoupon) return;
    const targetCode = lookedUpCoupon.code;
    setIsRedeeming(true);
    setRedeemFeedback(null);

    try {
      const res = await fetch(
        `/api/staff/coupons/${encodeURIComponent(targetCode)}/redeem`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (res.status === 401) {
        setUser(null);
        return;
      }

      if (res.status >= 500) {
        setRedeemFeedback({
          type: 'network',
          message:
            '서버 응답이 원활하지 않아 사용 처리 여부를 확정하지 못했습니다. 같은 번호의 서버 상태를 다시 조회해 주세요.',
          code: targetCode,
        });
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (data.coupon) {
          setLookedUpCoupon(data.coupon);
        }
        setRedeemFeedback({
          type: 'error',
          message: data.error || '사용 확정을 처리할 수 없습니다.',
          code: targetCode,
        });
        loadDashboard();
        return;
      }

      setLookedUpCoupon(data.coupon);
      setRedeemFeedback({
        type: 'success',
        message: '사용 확정이 완료되었습니다.',
        code: targetCode,
      });
      loadDashboard();
    } catch {
      setRedeemFeedback({
        type: 'network',
        message:
          '통신이 끊어져 사용 처리 여부를 확정하지 못했습니다. 혜택을 제공하기 전에 아래 버튼으로 서버 상태를 다시 조회해 주세요.',
        code: targetCode,
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage(null);

    const pricesPayload: Record<string, number | null> = {};
    for (const item of menuItems) {
      const raw = (priceDrafts[item.id] || '').replace(/,/g, '').trim();
      const num = Number(raw);
      pricesPayload[item.id] = raw && Number.isFinite(num) && num > 0 ? num : null;
    }

    try {
      const res = await fetch('/api/staff/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: storeDraft,
          prices: pricesPayload,
          campaign: {
            liveIssueStartAt: kstInputToIso(campaignDraft.liveIssueStartAt),
            liveIssueEndAt: kstInputToIso(campaignDraft.liveIssueEndAt),
            liveRedeemEndAt: kstInputToIso(campaignDraft.liveRedeemEndAt),
            liveStatus: campaignDraft.liveStatus,
          },
        }),
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        setSettingsMessage('설정을 저장하지 못했습니다.');
        return;
      }
      setSettingsMessage('설정이 저장되었습니다. 공개 페이지에 즉시 반영됩니다.');
      loadDashboard();
    } catch {
      setSettingsMessage('네트워크 오류로 설정을 저장하지 못했습니다.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#FFFBF4] flex items-center justify-center p-4">
        <p className="text-sm text-[#3D261C]/75">직원 인증 상태를 확인하고 있습니다…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFBF4] text-[#3D261C] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border border-[#3D261C]/12 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#D65718]">당근카페 매장 전용</p>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="text-xs font-medium text-[#46733D] hover:underline"
            >
              고객 페이지
            </a>
          </div>
          <h1 className="font-display mt-2 text-2xl text-[#3D261C]">
            직원 쿠폰 관리 로그인
          </h1>
          <p className="mt-1 text-xs text-[#3D261C]/75">
            바코드 조회 및 사용 확정을 위해 직원 계정으로 로그인해 주세요.
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="staff-id"
                className="block text-xs font-semibold text-[#3D261C]"
              >
                직원 ID
              </label>
              <input
                id="staff-id"
                type="text"
                required
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="예: staff1"
                className="mt-1.5 w-full min-h-[44px] rounded-2xl border border-[#3D261C]/20 bg-[#FFFBF4]/70 px-3.5 text-sm text-[#3D261C] focus:border-[#D65718] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="staff-pin"
                className="block text-xs font-semibold text-[#3D261C]"
              >
                비밀번호
              </label>
              <input
                id="staff-pin"
                type="password"
                required
                autoComplete="current-password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="비밀번호 입력"
                className="mt-1.5 w-full min-h-[44px] rounded-2xl border border-[#3D261C]/20 bg-[#FFFBF4]/70 px-3.5 text-sm text-[#3D261C] focus:border-[#D65718] focus:outline-none"
              />
            </div>

            {loginError && (
              <p role="alert" className="text-xs font-medium text-[#C0392B]">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[44px] rounded-2xl bg-[#D65718] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#B5430F] disabled:opacity-50 transition-colors"
            >
              {isLoggingIn ? '로그인 중…' : '로그인'}
            </button>
          </form>

          <p className="mt-4 pt-3 border-t border-[#3D261C]/10 text-[11px] text-[#3D261C]/60">
            초기 테스트 계정: staff1 / icon2026 (또는 manager / admin2026)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF4] text-[#3D261C]">
      {/* Top Bar */}
      <header className="border-b border-[#3D261C]/10 bg-white/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#3D261C]/75 hover:text-[#D65718] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              고객 화면
            </a>
            <span aria-hidden="true" className="text-[#3D261C]/20">
              /
            </span>
            <h1 className="font-display text-base sm:text-lg text-[#3D261C] truncate">
              당근카페 직원 쿠폰 관리
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#3D261C]/75">
              {user.name} ({user.id})
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D261C]/15 px-3 py-1.5 text-xs font-medium text-[#3D261C] hover:bg-[#FFEEDB]/50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {/* 운영 확인 지표 (테스트 쿠폰 집계 제외) */}
        <section aria-label="실운영 쿠폰 지표">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#3D261C]/10 bg-white p-4">
              <p className="text-xs text-[#3D261C]/65">실운영 발급 건수</p>
              <p className="mt-1 text-2xl font-bold text-[#3D261C] tabular-nums">
                {metrics.issuedCount.toLocaleString('ko-KR')}건
              </p>
            </div>
            <div className="rounded-2xl border border-[#3D261C]/10 bg-white p-4">
              <p className="text-xs text-[#3D261C]/65">실운영 사용 완료</p>
              <p className="mt-1 text-2xl font-bold text-[#D65718] tabular-nums">
                {metrics.usedCount.toLocaleString('ko-KR')}건
              </p>
            </div>
            <div className="rounded-2xl border border-[#3D261C]/10 bg-white p-4">
              <p className="text-xs text-[#3D261C]/65">발급 대비 사용률</p>
              <p className="mt-1 text-2xl font-bold text-[#3D261C] tabular-nums">
                {metrics.redemptionRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-[#46733D]/15 bg-[#EFF6E9] p-4">
              <p className="text-xs text-[#3D261C]/70">테스트 쿠폰 (집계 제외)</p>
              <p className="mt-1 text-sm font-semibold text-[#355E2D] tabular-nums">
                발급 {metrics.testIssuedCount}건 · 사용 {metrics.testUsedCount}건
              </p>
            </div>
          </div>
        </section>

        {/* Tab Switch */}
        <div className="flex items-center justify-between gap-4 border-b border-[#3D261C]/10 pb-3">
          <div className="inline-flex items-center gap-1 rounded-2xl bg-[#FFEEDB]/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('redeem')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'redeem'
                  ? 'bg-[#D65718] text-white'
                  : 'text-[#3D261C]/80 hover:text-[#3D261C]'
              }`}
            >
              <ScanBarcode className="h-4 w-4" />
              쿠폰 조회 · 사용 확정
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-[#D65718] text-white'
                  : 'text-[#3D261C]/80 hover:text-[#3D261C]'
              }`}
            >
              <Settings className="h-4 w-4" />
              매장 · 메뉴 · 행사 설정
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D261C]/15 bg-white px-3 py-2 text-xs font-medium text-[#3D261C] hover:bg-[#FFEEDB]/50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </button>
        </div>

        {activeTab === 'redeem' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Scanner & Confirmation */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-[#3D261C]/12 bg-white p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#3D261C]">
                    바코드 스캔 또는 번호 입력
                  </h2>
                  <p className="mt-1 text-xs text-[#3D261C]/75">
                    스캔 및 조회 단계에서는 쿠폰이 사용 처리되지 않습니다.
                  </p>
                </div>

                <form onSubmit={handleLookupSubmit} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="바코드 스캔 또는 쿠폰 번호 (예: IC...)"
                      aria-label="쿠폰 번호 입력"
                      className="flex-1 min-h-[44px] rounded-2xl border border-[#3D261C]/20 bg-[#FFFBF4]/70 px-3.5 font-mono-code text-sm uppercase text-[#3D261C] focus:border-[#D65718] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isLookingUp}
                      className="min-h-[44px] rounded-2xl bg-[#D65718] px-4 text-sm font-bold text-white hover:bg-[#B5430F] disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isLookingUp ? '조회 중…' : '조회'}
                    </button>
                  </div>
                </form>

                {lookupError && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-[#C0392B]/25 bg-[#FDEDEC] p-3.5 text-xs font-medium text-[#922B21] flex items-start gap-2"
                  >
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                {redeemFeedback && (
                  <div
                    role="alert"
                    className={`rounded-2xl p-3.5 text-xs space-y-2 border ${
                      redeemFeedback.type === 'success'
                        ? 'border-[#46733D]/25 bg-[#EFF6E9] text-[#355E2D]'
                        : redeemFeedback.type === 'network'
                          ? 'border-[#D65718]/40 bg-[#FFEEDB] text-[#8E410E]'
                          : 'border-[#C0392B]/25 bg-[#FDEDEC] text-[#922B21]'
                    }`}
                  >
                    <p className="font-semibold">{redeemFeedback.message}</p>
                    {redeemFeedback.type === 'network' && redeemFeedback.code && (
                      <button
                        type="button"
                        onClick={() => lookupCode(redeemFeedback.code!)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#D65718] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#B5430F]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        서버 상태 다시 조회
                      </button>
                    )}
                  </div>
                )}

                {lookedUpCoupon && (
                  <div className="rounded-2xl border border-[#3D261C]/15 bg-[#FFFBF4]/80 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-code text-sm font-bold text-[#3D261C]">
                        {lookedUpCoupon.code}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          lookedUpCoupon.status === 'unused'
                            ? 'text-[#355E2D]'
                            : lookedUpCoupon.status === 'used'
                              ? 'text-[#C0392B]'
                              : 'text-[#B5430F]'
                        }`}
                      >
                        {lookedUpCoupon.status === 'unused'
                          ? '사용 가능'
                          : lookedUpCoupon.status === 'used'
                            ? '이미 사용된 쿠폰입니다'
                            : '유효기간이 만료된 쿠폰입니다'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-[#3D261C]/85">
                      <p className="font-semibold text-[#355E2D]">
                        {lookedUpCoupon.benefitText}
                      </p>
                      <p>{lookedUpCoupon.conditionText}</p>
                      <p className="tabular-nums text-[#3D261C]/70">
                        구분: {lookedUpCoupon.isTest ? '테스트 쿠폰 (통계 제외)' : '실운영 쿠폰'}
                      </p>
                      <p className="tabular-nums text-[#3D261C]/70">
                        유효기간: {formatKstDateTime(lookedUpCoupon.expiresAt)}까지
                      </p>
                      {lookedUpCoupon.usedAt && (
                        <p className="tabular-nums font-medium text-[#922B21]">
                          사용일시: {formatKstDateTime(lookedUpCoupon.usedAt)} (처리:{' '}
                          {lookedUpCoupon.usedByName || lookedUpCoupon.usedBy})
                        </p>
                      )}
                    </div>

                    {lookedUpCoupon.status === 'unused' ? (
                      <div className="pt-2 border-t border-[#3D261C]/10 space-y-2.5">
                        <p className="text-xs font-medium text-[#3D261C]/80 flex items-start gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#D65718]" />
                          <span>
                            첫 방문 고객 여부와 유기농 당근케이크 구매를 확인한 뒤 사용 확정해 주세요.
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRedeem}
                            disabled={isRedeeming}
                            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#46733D] px-4 text-sm font-bold text-white hover:bg-[#355E2D] disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {isRedeeming ? '처리 중…' : '사용 확정'}
                          </button>
                          <button
                            type="button"
                            onClick={handleResetLookup}
                            className="min-h-[44px] rounded-2xl border border-[#3D261C]/20 bg-white px-4 text-xs font-semibold text-[#3D261C] hover:bg-[#3D261C]/5"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResetLookup}
                        className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 bg-white text-xs font-semibold text-[#3D261C] hover:bg-[#3D261C]/5"
                      >
                        다음 쿠폰 조회
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Recent Coupon Table */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-[#3D261C]/12 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#3D261C]/10">
                  <h2 className="text-base font-bold text-[#3D261C]">
                    최근 쿠폰 내역
                  </h2>
                  <label className="inline-flex items-center gap-2 text-xs text-[#3D261C]/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTestInList}
                      onChange={(e) => setIncludeTestInList(e.target.checked)}
                      className="h-4 w-4 accent-[#D65718]"
                    />
                    테스트 쿠폰 포함
                  </label>
                </div>

                {recentCoupons.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#3D261C]/65">
                    아직 발급된 쿠폰이 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FFFBF4] text-[#3D261C]/70 border-b border-[#3D261C]/10">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">쿠폰 번호</th>
                          <th className="px-4 py-2.5 font-semibold">구분</th>
                          <th className="px-4 py-2.5 font-semibold">상태</th>
                          <th className="px-4 py-2.5 font-semibold">발급 시각(KST)</th>
                          <th className="px-4 py-2.5 font-semibold">사용/처리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D261C]/8">
                        {recentCoupons.map((row) => (
                          <tr
                            key={row.code}
                            onClick={() => {
                              setCodeInput(row.code);
                              lookupCode(row.code);
                            }}
                            className="hover:bg-[#FFEEDB]/40 cursor-pointer"
                          >
                            <td className="px-4 py-2.5 font-mono-code font-semibold text-[#3D261C]">
                              {row.code}
                            </td>
                            <td className="px-4 py-2.5 text-[#3D261C]/75">
                              {row.isTest ? '테스트' : '실운영'}
                            </td>
                            <td className="px-4 py-2.5 font-semibold">
                              <span
                                className={
                                  row.status === 'unused'
                                    ? 'text-[#355E2D]'
                                    : row.status === 'used'
                                      ? 'text-[#C0392B]'
                                      : 'text-[#B5430F]'
                                }
                              >
                                {row.status === 'unused'
                                  ? '미사용'
                                  : row.status === 'used'
                                    ? '사용 완료'
                                    : '기간 만료'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-[#3D261C]/75">
                              {formatKstDateTime(row.issuedAt)}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-[#3D261C]/75">
                              {row.usedAt
                                ? `${formatKstDateTime(row.usedAt)} (${row.usedByName || row.usedBy})`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Settings Tab */
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Store Info */}
              <div className="rounded-3xl border border-[#3D261C]/12 bg-white p-5 space-y-4">
                <h2 className="text-base font-bold text-[#3D261C]">
                  매장 정보 설정
                </h2>
                <p className="text-xs text-[#3D261C]/70">
                  확정된 정보만 입력해 주세요. 비어 있는 항목은 고객 화면에 임시 문구로 안내됩니다.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">매장명</label>
                    <input
                      type="text"
                      value={storeDraft.brandName}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, brandName: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">매장 주소</label>
                    <input
                      type="text"
                      value={storeDraft.address}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, address: e.target.value }))
                      }
                      placeholder="예: 서울특별시 성동구 연무장길 00"
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">영업시간</label>
                    <input
                      type="text"
                      value={storeDraft.hours}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, hours: e.target.value }))
                      }
                      placeholder="예: 매일 09:00 - 21:00"
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      지도 길찾기 URL (입력 시 ‘길찾기’ 버튼 표시)
                    </label>
                    <input
                      type="url"
                      value={storeDraft.mapUrl}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, mapUrl: e.target.value }))
                      }
                      placeholder="https://map.kakao.com/..."
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">전화번호</label>
                    <input
                      type="tel"
                      value={storeDraft.phone}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, phone: e.target.value }))
                      }
                      placeholder="010-0000-0000"
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      유튜브 바로가기 URL
                    </label>
                    <input
                      type="url"
                      value={storeDraft.youtubeUrl}
                      onChange={(e) =>
                        setStoreDraft((s) => ({ ...s, youtubeUrl: e.target.value }))
                      }
                      placeholder="https://www.youtube.com/..."
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Campaign Schedule */}
              <div className="rounded-3xl border border-[#3D261C]/12 bg-white p-5 space-y-4">
                <h2 className="text-base font-bold text-[#3D261C]">
                  실운영 행사 일정 설정 (KST)
                </h2>
                <p className="text-xs text-[#3D261C]/70">
                  일정이 비어 있거나 초안 상태이면 공개 화면에는 ‘쿠폰 준비 중’이 표시되고, 미리보기에서만 테스트 쿠폰을 발급할 수 있습니다.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">운영 상태</label>
                    <select
                      value={campaignDraft.liveStatus}
                      onChange={(e) =>
                        setCampaignDraft((c) => ({
                          ...c,
                          liveStatus: e.target.value as
                            | 'draft'
                            | 'active'
                            | 'paused'
                            | 'ended',
                        }))
                      }
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm bg-white"
                    >
                      <option value="draft">초안 (공개 화면 준비 중 표시)</option>
                      <option value="active">실운영 중</option>
                      <option value="paused">일시 중단</option>
                      <option value="ended">종료</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      발급 시작 시각 (KST)
                    </label>
                    <input
                      type="datetime-local"
                      value={campaignDraft.liveIssueStartAt}
                      onChange={(e) =>
                        setCampaignDraft((c) => ({
                          ...c,
                          liveIssueStartAt: e.target.value,
                        }))
                      }
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      발급 종료 시각 (KST)
                    </label>
                    <input
                      type="datetime-local"
                      value={campaignDraft.liveIssueEndAt}
                      onChange={(e) =>
                        setCampaignDraft((c) => ({
                          ...c,
                          liveIssueEndAt: e.target.value,
                        }))
                      }
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      쿠폰 사용 종료 시각 (KST)
                    </label>
                    <input
                      type="datetime-local"
                      value={campaignDraft.liveRedeemEndAt}
                      onChange={(e) =>
                        setCampaignDraft((c) => ({
                          ...c,
                          liveRedeemEndAt: e.target.value,
                        }))
                      }
                      className="w-full min-h-[40px] rounded-2xl border border-[#3D261C]/20 px-3 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#3D261C]/10 flex flex-wrap gap-3 text-xs">
                  <a
                    href="/?preview=test"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#D65718] font-medium underline underline-offset-4"
                  >
                    테스트 쿠폰 미리보기 열기
                  </a>
                  <a
                    href="/?mode=public"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3D261C]/75 font-medium underline underline-offset-4"
                  >
                    공개 상태 미리보기 열기
                  </a>
                </div>
              </div>
            </div>

            {/* Menu Prices */}
            <div className="rounded-3xl border border-[#3D261C]/12 bg-white p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#3D261C]">
                  메뉴 판매가 설정 (원)
                </h2>
                <p className="mt-0.5 text-xs text-[#3D261C]/70">
                  판매가가 입력된 메뉴만 고객 화면에 가격이 표시됩니다. 미확정 메뉴는 비워 두세요.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {menuItems.map((item) => {
                  const num = Number((priceDrafts[item.id] || '').replace(/,/g, ''));
                  const previewPrice = formatPriceKRW(
                    Number.isFinite(num) && num > 0 ? num : null,
                  );
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#3D261C]/12 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#3D261C] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[#3D261C]/60 tabular-nums">
                          {previewPrice ? `표시: ${previewPrice}` : '가격 미표시'}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={priceDrafts[item.id] ?? ''}
                        onChange={(e) =>
                          setPriceDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                        }
                        placeholder="미입력"
                        aria-label={`${item.name} 가격`}
                        className="w-24 min-h-[38px] rounded-xl border border-[#3D261C]/20 px-2.5 text-right text-sm tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {settingsMessage ? (
                <p className="text-xs font-semibold text-[#355E2D]">
                  {settingsMessage}
                </p>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={isSavingSettings}
                className="min-h-[44px] rounded-2xl bg-[#D65718] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#B5430F] disabled:opacity-50"
              >
                {isSavingSettings ? '저장 중…' : '설정 저장'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUpRight, Clock, Coffee, MapPin, Navigation, Phone, Ticket } from 'lucide-react';
import carrotCakeSpotlightImg from '../assets/images/carrot_cake_spotlight_1794713461388.jpg';
import carrotBunnyMascotImg from '../assets/images/carrot_bunny_mascot_1794713459967.jpg';
import type {
  CustomerCouponDTO,
  MenuItemConfig,
  PublicConfigResponse,
  StorePlaceDetails,
} from '../shared/types.ts';
import {
  formatKstDate,
  formatPriceKRW,
  getStoredSessionToken,
  setStoredSessionToken,
} from '../lib/formatters.ts';
import { CouponModal } from '../components/CouponModal.tsx';
import { StoreLocationMap } from '../components/StoreLocationMap.tsx';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

type MenuFilter = 'all' | 'coffee' | 'non-coffee';

const HERO_TYPING_TEXT = '[당근카페 유기농 당근 케이크]';
const HERO_TYPING_CHARS = Array.from(HERO_TYPING_TEXT);

function TypingHeroHeadline({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null;
}) {
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    shouldReduceMotion ? HERO_TYPING_CHARS.length : 0,
  );

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisibleCount(HERO_TYPING_CHARS.length);
      return;
    }

    let timeoutId: number;

    if (visibleCount < HERO_TYPING_CHARS.length) {
      timeoutId = window.setTimeout(() => {
        setVisibleCount((prev) => prev + 1);
      }, 135);
    } else {
      timeoutId = window.setTimeout(() => {
        setVisibleCount(0);
      }, 2000);
    }

    return () => window.clearTimeout(timeoutId);
  }, [visibleCount, shouldReduceMotion]);

  const typedText = shouldReduceMotion
    ? HERO_TYPING_TEXT
    : HERO_TYPING_CHARS.slice(0, visibleCount).join('');

  return (
    <h1
      aria-label={HERO_TYPING_TEXT}
      className="font-display mt-2 sm:mt-3 grid text-[28px] leading-[1.28] sm:text-4xl lg:text-[42px] text-[#3D261C] [text-wrap:balance]"
    >
      {/* Reserve full phrase height so typing never shifts surrounding content */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 select-none"
      >
        {HERO_TYPING_TEXT}
        <span className="inline-block w-[3px] ml-1" />
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1">
        <span>{typedText}</span>
        {!shouldReduceMotion && (
          <span
            aria-hidden="true"
            className="animate-cursor-blink ml-1 inline-block h-[0.88em] w-[3px] translate-y-[0.08em] rounded-full bg-[#D65718]"
          />
        )}
      </span>
    </h1>
  );
}

const FALLBACK_MENU_DESCRIPTIONS: Record<string, string> = {
  americano:
    '볶은 아몬드와 다크 초콜릿의 고소한 풍미가 살아있어 당근케이크와 가장 잘 어울리는 하우스 블렌드 커피예요.',
  'cafe-latte':
    '진하게 내린 에스프레소에 부드럽고 달큰한 스팀 밀크를 넉넉히 담아 고소하고 포근한 맛을 느낄 수 있어요.',
  'vanilla-latte':
    '천연 바닐라빈을 듬뿍 우려낸 수제 바닐라 시럽을 더해 인위적이지 않고 은은하게 달콤한 라테예요.',
  cappuccino:
    '벨벳처럼 폭신하고 쫀쫀한 우유 거품 위에 향긋한 시나몬 가루를 톡톡 올려 따뜻하게 즐기는 클래식 커피예요.',
  'chocolate-latte':
    '진한 벨기에산 다크 코코아를 우유에 부드럽게 녹여내어 남녀노소 누구나 기분 좋게 즐기는 달콤한 라테예요.',
  'matcha-latte':
    '제주산 1등급 유기농 어린잎 말차의 깔끔하고 진한 쌉싸름함에 부드러운 우유를 더한 초록빛 라테예요.',
  'grapefruit-ade':
    '알알이 과육이 살아있는 수제 자몽청과 톡 쏘는 탄산수가 만나 입안을 상큼하게 깨워주는 과일 에이드예요.',
  'chamomile-tea':
    '향긋한 사과 꽃향이 은은하게 퍼져 마음을 포근하게 달래주는 카페인 프리 허브티예요.',
};

function MenuCardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="aspect-square w-full bg-[#FFEEDB]/70 flex flex-col items-center justify-center p-4 text-center">
        <Coffee className="h-6 w-6 text-[#D65718]/75" />
        <span className="mt-2 text-xs font-medium text-[#3D261C]/75">{alt}</span>
      </div>
    );
  }

  return (
    <div className="aspect-square w-full overflow-hidden bg-[#FFF2E2]">
      <img
        src={src}
        alt={alt}
        width={414}
        height={414}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}

function MenuFlipCard({ item }: { item: MenuItemConfig }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const formattedPrice = formatPriceKRW(item.price);
  const categoryLabel = item.category === 'coffee' ? '커피' : '논커피';
  const description =
    item.description ||
    FALLBACK_MENU_DESCRIPTIONS[item.id] ||
    '당근카페에서 정성스럽게 준비한 시그니처 음료예요.';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isFlipped}
      aria-label={`${item.name} 메뉴 정보 뒤집기`}
      data-flipped={isFlipped ? 'true' : 'false'}
      onClick={() => setIsFlipped((prev) => !prev)}
      onMouseLeave={() => setIsFlipped(false)}
      onBlur={() => setIsFlipped(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFlipped((prev) => !prev);
        }
      }}
      className="menu-flip-card group block w-full text-left rounded-2xl cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
    >
      <div className="menu-flip-inner">
        {/* 앞면: 메뉴 이미지 · 카테고리 · 메뉴명 · 가격 */}
        <div className="menu-flip-face menu-flip-front overflow-hidden rounded-2xl border border-[#3D261C]/10 bg-white">
          <MenuCardImage src={item.image} alt={item.name} />
          <div className="px-3.5 py-3 sm:px-4 sm:py-3.5">
            <p className="text-[11px] font-medium text-[#3D261C]/60">
              {categoryLabel}
            </p>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#3D261C] truncate">
                {item.name}
              </h3>
              {formattedPrice && (
                <span className="text-xs sm:text-sm font-semibold text-[#D65718] tabular-nums shrink-0">
                  {formattedPrice}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 뒷면: 마우스 오버 시 3D 회전하여 카페 메뉴, 가격, 설명 표시 */}
        <div className="menu-flip-face menu-flip-back absolute inset-0 overflow-hidden rounded-2xl border border-[#D65718]/25 bg-[#FFF4E4] p-3.5 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#46733D]">
                {categoryLabel}
              </span>
              <span className="text-[11px] font-medium text-[#3D261C]/50">
                당근카페
              </span>
            </div>
            <p className="font-display mt-1.5 text-base sm:text-xl text-[#3D261C] leading-snug">
              {item.name}
            </p>
            <p className="mt-0.5 text-xs sm:text-base font-bold text-[#D65718] tabular-nums">
              {formattedPrice ?? '가격 매장 문의'}
            </p>
          </div>

          <div className="my-2 border-t border-[#3D261C]/10 pt-2.5 sm:pt-3 flex-1 flex items-center">
            <p className="text-[11px] sm:text-[13px] leading-relaxed text-[#3D261C]/85">
              {description}
            </p>
          </div>

          <p className="text-[10px] sm:text-[11px] font-medium text-[#3D261C]/55">
            {item.category === 'coffee'
              ? '하우스 블렌드 · HOT / ICE'
              : '데일리 음료 · 당근케이크 페어링'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ImageWithFallback({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="h-full w-full bg-[#FFEEDB] flex flex-col items-center justify-center p-6 text-center">
        <Coffee className="h-8 w-8 text-[#D65718]" />
        <span className="mt-2 text-sm font-medium text-[#3D261C]/80">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding={eager ? 'sync' : 'async'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const shouldReduceMotion = useReducedMotion();
  const [config, setConfig] = useState<PublicConfigResponse | null>(null);
  const [coupon, setCoupon] = useState<CustomerCouponDTO | null>(null);
  const [menuFilter, setMenuFilter] = useState<MenuFilter>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const [place, setPlace] = useState<StorePlaceDetails | null>(null);
  const [placeLoading, setPlaceLoading] = useState(true);

  const heroCtaRef = useRef<HTMLButtonElement | null>(null);
  const stickyCtaRef = useRef<HTMLButtonElement | null>(null);
  const headerCtaRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuGridRef = useRef<HTMLDivElement | null>(null);
  const couponGridRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  const menuInView = useInView(menuGridRef, { once: true, amount: 0.12 });
  const couponInView = useInView(couponGridRef, { once: true, amount: 0.2 });

  const querySuffix = (() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const preview = params.get('preview');
    const q = new URLSearchParams();
    if (mode) q.set('mode', mode);
    if (preview) q.set('preview', preview);
    const str = q.toString();
    return str ? `?${str}` : '';
  })();

  const buildHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = getStoredSessionToken();
    if (token) {
      headers['X-Icon-Session'] = token;
    }
    return headers;
  }, []);

  const loadInitialData = useCallback(async () => {
    setPlaceLoading(true);
    try {
      const [cfgRes, meRes, placeRes] = await Promise.all([
        fetch(`/api/config${querySuffix}`, { credentials: 'include' }),
        fetch(`/api/coupons/me${querySuffix}`, {
          credentials: 'include',
          headers: buildHeaders(),
        }),
        fetch('/api/store/place', { credentials: 'include' }),
      ]);
      if (cfgRes.ok) {
        const cfgData = (await cfgRes.json()) as PublicConfigResponse;
        setConfig(cfgData);
      }
      if (meRes.ok) {
        const meData = (await meRes.json()) as { coupon: CustomerCouponDTO | null };
        setCoupon(meData.coupon);
      }
      if (placeRes.ok) {
        const placeData = (await placeRes.json()) as {
          place: StorePlaceDetails | null;
        };
        setPlace(placeData.place);
      }
    } catch {
      // Initial load failure handled silently; user can retry coupon action
    } finally {
      setPlaceLoading(false);
    }
  }, [buildHeaders, querySuffix]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const target = heroCtaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setHeroCtaVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [config]);

  useEffect(() => {
    const target = footerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setFooterVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleOpenOrIssueCoupon = async (
    triggerEl: HTMLButtonElement | null,
  ) => {
    lastTriggerRef.current = triggerEl;
    setModalError(null);

    if (coupon) {
      setIsModalOpen(true);
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/coupons/me${querySuffix}`, {
          credentials: 'include',
          headers: buildHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as { coupon: CustomerCouponDTO | null };
          if (data.coupon) setCoupon(data.coupon);
        }
      } catch {
        // Keep cached coupon if refresh fails
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    if (config && config.availability !== 'ready') {
      return;
    }

    setIsModalOpen(true);
    setIsIssuing(true);
    try {
      const res = await fetch(`/api/coupons/issue${querySuffix}`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || '쿠폰을 발급할 수 없습니다.');
        return;
      }
      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken);
      }
      setCoupon(data.coupon);
    } catch {
      setModalError('네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRefreshCoupon = async () => {
    setIsRefreshing(true);
    setModalError(null);
    try {
      const res = await fetch(`/api/coupons/me${querySuffix}`, {
        credentials: 'include',
        headers: buildHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { coupon: CustomerCouponDTO | null };
        if (data.coupon) setCoupon(data.coupon);
      }
    } catch {
      setModalError('상태를 새로고침하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const signatureItem =
    config?.menu.find((m) => m.category === 'signature') ?? {
      id: 'carrot-cake',
      category: 'signature',
      name: '유기농 당근케이크',
      description:
        '제주 구좌 유기농 당근으로 만들었어요. 당근과 과일 본연의 달콤함을 한 조각에 담았습니다.',
      image: '/images/menu/carrot-cake.webp',
      price: null,
    };

  const beverageItems: MenuItemConfig[] = (config?.menu ?? []).filter(
    (m) => m.category !== 'signature',
  );
  const filteredBeverages = beverageItems.filter((item) =>
    menuFilter === 'all' ? true : item.category === menuFilter,
  );

  const availability = config?.availability ?? 'ready';
  const isCouponActionDisabled = !coupon && availability !== 'ready';

  const getCtaLabel = (): string => {
    if (coupon) {
      if (coupon.status === 'used') return '쿠폰 사용 내역';
      if (coupon.status === 'expired') return '만료된 쿠폰 확인';
      return '발급된 쿠폰 보기';
    }
    switch (availability) {
      case 'preparing':
        return '쿠폰 준비 중';
      case 'upcoming':
        return '쿠폰 오픈 예정';
      case 'paused':
        return '쿠폰 일시 중단';
      case 'ended':
        return '행사 종료';
      default:
        return '첫 방문 쿠폰 받기';
    }
  };

  const ctaLabel = getCtaLabel();
  const showStickyCta = !heroCtaVisible && !footerVisible && !isModalOpen;
  const store = config?.store;
  const campaign = config?.campaign;
  const signaturePrice = formatPriceKRW(signatureItem.price);
  const brandName = store?.brandName || '당근카페';
  const kakaoAppKey =
    (import.meta.env.VITE_KAKAO_MAP_APPKEY as string | undefined)?.trim() ||
    config?.kakaoMapAppKey ||
    '';
  const displayAddress = store?.address || '소노벨 영덕';
  const kakaoLabel = encodeURIComponent(`${brandName} (${displayAddress})`);
  const fallbackSearchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(displayAddress)}`;
  const directionsHref =
    store?.mapUrl ||
    place?.directionsUri ||
    (place?.location
      ? `https://map.kakao.com/link/to/${kakaoLabel},${place.location.lat},${place.location.lng}`
      : fallbackSearchUrl);
  const shortcutHref =
    store?.mapUrl ||
    place?.kakaoMapUri ||
    (place?.location
      ? `https://map.kakao.com/link/map/${kakaoLabel},${place.location.lat},${place.location.lng}`
      : fallbackSearchUrl);

  const revealProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <div className="min-h-screen bg-[#FFFBF4] text-[#3D261C] flex flex-col">
      {/* 1. 상단 내비게이션 (3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-30 border-b border-[#3D261C]/10 bg-[#FFFBF4]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#top"
            className="font-display text-xl tracking-tight text-[#D65718] whitespace-nowrap shrink-0"
          >
            {brandName}
          </a>

          <nav
            aria-label="주요 메뉴 이동"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#3D261C]/80"
          >
            <a
              href="#new-menu"
              className="hover:text-[#D65718] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              신메뉴
            </a>
            <a
              href="#menu"
              className="hover:text-[#D65718] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              전체 메뉴
            </a>
            <a
              href="#coupon-guide"
              className="hover:text-[#D65718] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              쿠폰 안내
            </a>
            <a
              href="#store-info"
              className="hover:text-[#D65718] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              매장 안내
            </a>
          </nav>

          <button
            ref={headerCtaRef}
            type="button"
            disabled={isCouponActionDisabled}
            onClick={() => handleOpenOrIssueCoupon(headerCtaRef.current)}
            className="inline-flex items-center justify-center rounded-xl bg-[#D65718] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5430F] disabled:bg-[#3D261C]/25 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
          >
            {ctaLabel}
          </button>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* 2. 첫 화면 히어로 */}
        <section className="relative overflow-hidden border-b border-[#3D261C]/8">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:py-16">
            <div className="grid grid-cols-1 gap-6 sm:gap-10 lg:grid-cols-12 lg:items-stretch">
              <div className="lg:col-span-6 lg:order-2">
                <div className="relative h-[240px] sm:h-[340px] lg:h-full lg:min-h-[440px] w-full overflow-hidden rounded-3xl border border-[#3D261C]/10 bg-[#FFF2E2]">
                  <ImageWithFallback
                    src={carrotCakeSpotlightImg}
                    alt="제주 구좌 유기농 당근으로 만든 당근카페 유기농 당근케이크와 따뜻한 라테"
                    eager
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              </div>

              <motion.div
                {...revealProps}
                className="lg:col-span-6 lg:order-1 flex flex-col justify-center"
              >
                <p className="text-xs sm:text-sm font-semibold text-[#46733D]">
                  신메뉴 출시 · 제주 구좌 유기농 당근 사용
                </p>

                <TypingHeroHeadline shouldReduceMotion={shouldReduceMotion} />

                <p className="mt-2.5 sm:mt-3 text-base sm:text-lg font-bold text-[#D65718]">
                  당근과 과일이 더해주는 포근한 달콤함
                </p>

                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#3D261C]/80 max-w-lg">
                  제주 구좌에서 자란 아삭한 유기농 당근과 과일 본연의 은은한 단맛, 폭신한 크림치즈 프로스팅을 한 조각에 소복이 담았어요.
                </p>

                {/* 첫 방문 혜택 카드 */}
                <div className="mt-4 sm:mt-6 rounded-2xl bg-[#FFEEDB]/80 px-4 py-3.5 border border-[#D65718]/18">
                  <div className="flex items-start gap-3">
                    <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-[#D65718]" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#3D261C]">
                        첫 방문 선물 — 유기농 당근케이크 구매 시 아메리카노 1잔 무료
                      </p>
                      <p className="mt-0.5 text-[11px] sm:text-xs text-[#3D261C]/75">
                        {config?.isPreviewTestMode
                          ? '미리보기 테스트 행사 중 · 회원가입 없이 바코드 즉시 발급'
                          : availability === 'preparing'
                            ? '행사 일정 확정 후 공개됩니다'
                            : '회원가입 없이 바코드 즉시 발급 · 계산대 제시'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 주 행동 & 보조 링크 */}
                <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  <button
                    ref={heroCtaRef}
                    type="button"
                    disabled={isCouponActionDisabled}
                    onClick={() => handleOpenOrIssueCoupon(heroCtaRef.current)}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D65718] px-6 py-3 text-sm sm:text-base font-bold text-white hover:bg-[#B5430F] disabled:bg-[#3D261C]/25 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718] whitespace-nowrap shrink-0"
                  >
                    <Ticket className="h-4 w-4 shrink-0" />
                    <span>{ctaLabel}</span>
                  </button>

                  <div className="flex items-center gap-4 text-xs sm:text-sm font-medium text-[#3D261C]/80 pl-0.5">
                    <a
                      href="#menu"
                      className="inline-flex items-center gap-1 hover:text-[#D65718] underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      전체 메뉴 보기
                      <ArrowDown className="h-3.5 w-3.5" />
                    </a>
                    <span aria-hidden="true" className="text-[#3D261C]/25">
                      /
                    </span>
                    <a
                      href="#store-info"
                      className="inline-flex items-center gap-1 hover:text-[#D65718] underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      매장 위치 확인
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 3. 당근카페 마스코트 & 신메뉴 이야기 */}
        <section id="new-menu" className="border-b border-[#3D261C]/8 bg-[#FFF3E3]/70">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: 0, ease: [0.16, 1, 0.3, 1] }}
                className="md:col-span-5"
              >
                <div className="aspect-square max-w-[340px] mx-auto md:mx-0 overflow-hidden rounded-3xl border border-[#3D261C]/10 bg-[#FFFBF4] p-2">
                  <ImageWithFallback
                    src={carrotBunnyMascotImg}
                    alt="초록 앞치마를 두르고 당근과 따뜻한 커피를 들고 반겨주는 당근카페 마스코트 토끼"
                    className="h-full w-full rounded-2xl object-cover object-center"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="md:col-span-7 space-y-4"
              >
                <p className="text-xs font-semibold text-[#46733D]">
                  당근카페의 오늘의 디저트
                </p>
                <h2 className="font-display text-2xl sm:text-3xl text-[#3D261C] [text-wrap:balance]">
                  당근토끼가 추천하는 {signatureItem.name}
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-[#3D261C]/85">
                  인위적인 설탕 맛 대신 제주 구좌 유기농 당근과 달콤한 과일, 고소한 호두를 듬뿍 넣었어요. 촉촉한 시트와 부드러운 크림치즈가 어우러져 커피 한 잔과 먹기 딱 좋은 데일리 케이크입니다.
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#3D261C]/75 pt-1">
                  <span>제주 구좌 유기농 당근</span>
                  <span aria-hidden="true">·</span>
                  <span>매장 직접 구운 시트</span>
                  <span aria-hidden="true">·</span>
                  <span>고소한 호두 토핑</span>
                  {signaturePrice && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-[#D65718] tabular-nums">
                        {signaturePrice}
                      </span>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4. 기본 메뉴 (커피 4종 + 논커피 4종) */}
        <section id="menu" className="border-b border-[#3D261C]/8">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#46733D]">함께 즐기는 음료</p>
                <h2 className="font-display mt-1 text-2xl sm:text-3xl text-[#3D261C]">
                  {brandName} 메뉴판
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#3D261C]/75">
                  당근케이크와 기분 좋게 어울리는 커피 4종과 논커피 4종이에요. 메뉴 카드에 마우스를 올리면 가격과 설명을 볼 수 있어요.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="메뉴 카테고리 필터"
                className="inline-flex items-center gap-1 rounded-2xl bg-[#FFEEDB]/80 p-1 self-start sm:self-auto"
              >
                {(
                  [
                    { key: 'all', label: '전체 8종' },
                    { key: 'coffee', label: '커피 4종' },
                    { key: 'non-coffee', label: '논커피 4종' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={menuFilter === tab.key}
                    onClick={() => setMenuFilter(tab.key)}
                    className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718] ${
                      menuFilter === tab.key
                        ? 'bg-[#D65718] text-white'
                        : 'text-[#3D261C]/80 hover:text-[#3D261C]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={menuGridRef}
              className="mt-7 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4"
            >
              {filteredBeverages.map((item, idx) => (
                <motion.article
                  key={item.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={
                    shouldReduceMotion || menuInView
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 28 }
                  }
                  transition={{
                    duration: 0.5,
                    delay: shouldReduceMotion ? 0 : idx * 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <MenuFlipCard item={item} />
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. 쿠폰 이용 안내 */}
        <section id="coupon-guide" className="border-b border-[#3D261C]/8 bg-[#EFF6E9]/65">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#46733D]">첫 방문 이벤트 안내</p>
              <h2 className="font-display mt-1 text-2xl sm:text-3xl text-[#3D261C]">
                아메리카노 무료 쿠폰, 이렇게 받아요
              </h2>
            </div>

            <div
              ref={couponGridRef}
              className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {[
                {
                  step: '01',
                  title: '바코드 쿠폰 받기',
                  desc: '회원가입 없이 버튼 한 번으로 지금 보고 계신 브라우저에 전용 바코드 쿠폰을 발급받아요.',
                },
                {
                  step: '02',
                  title: '카운터에서 보여주기',
                  desc: '당근카페 계산대에서 화면의 바코드 또는 쿠폰 번호를 직원에게 보여주세요.',
                },
                {
                  step: '03',
                  title: '당근케이크와 아메리카노 즐기기',
                  desc: '첫 방문 확인 후 유기농 당근케이크를 구매하시면 시원하거나 따뜻한 아메리카노 1잔을 드려요.',
                },
              ].map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={
                    shouldReduceMotion || couponInView
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 28 }
                  }
                  transition={{
                    duration: 0.55,
                    delay: shouldReduceMotion ? 0 : idx * 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="rounded-2xl border border-[#3D261C]/10 bg-[#FFFBF4] p-5"
                >
                  <p className="font-mono-code text-xs font-semibold text-[#D65718]">
                    STEP {item.step}
                  </p>
                  <h3 className="font-display mt-2 text-lg text-[#3D261C]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#3D261C]/80">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-white/90 px-5 py-3.5 border border-[#46733D]/15 text-xs sm:text-sm text-[#3D261C]/85 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p>
                <strong className="text-[#355E2D]">이용 조건</strong> · {brandName} 첫 방문 고객 1인 1회 · 유기농 당근케이크 구매 시 아메리카노 1잔 무료
              </p>
              <p className="text-xs text-[#3D261C]/70 tabular-nums shrink-0">
                {campaign?.isTest
                  ? '테스트 행사 운영 중 (사전 검증용)'
                  : campaign?.issueStartAt && campaign?.redeemEndAt
                    ? `행사 기간: ${formatKstDate(campaign.issueStartAt)} ~ ${formatKstDate(campaign.redeemEndAt)}`
                    : '행사 기간: 확정 후 공개 예정'}
              </p>
            </div>
          </div>
        </section>

        {/* 6. 매장 안내 */}
        <section id="store-info">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-[#3D261C]/10 bg-white p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center"
            >
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#46733D]">매장 안내</p>
                  <h2 className="font-display text-2xl sm:text-3xl text-[#3D261C]">
                    {brandName}에서 기다리고 있을게요
                  </h2>

                  <div className="space-y-2.5 text-sm text-[#3D261C]/85">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D65718]" />
                      <div>
                        <p className="font-semibold text-[#3D261C]">
                          {displayAddress}
                        </p>
                        {place?.formattedAddress &&
                          place.formattedAddress !== displayAddress && (
                            <p className="mt-0.5 text-xs text-[#3D261C]/65">
                              {place.formattedAddress}
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D65718]" />
                      <span className="tabular-nums">
                        {store?.hours
                          ? store.hours
                          : '영업시간은 확인 후 공개될 예정입니다.'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#D65718] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B5430F] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>길찾기</span>
                  </a>
                  <a
                    href={shortcutHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#3D261C]/18 bg-[#FFFBF4] px-5 py-2.5 text-sm font-semibold text-[#3D261C] hover:border-[#D65718]/45 hover:text-[#D65718] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
                  >
                    <span>바로 가기</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="lg:col-span-7">
                <StoreLocationMap
                  kakaoAppKey={kakaoAppKey}
                  brandName={brandName}
                  storeAddress={displayAddress}
                  place={place}
                  isLoading={placeLoading}
                  directionsHref={directionsHref}
                  shortcutHref={shortcutHref}
                />
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        ref={footerRef}
        className="border-t border-[#3D261C]/10 bg-[#FFFBF4] py-8"
      >
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-6 text-xs text-[#3D261C]/75">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-display text-sm text-[#D65718]">
                {brandName}
              </span>
              <span aria-hidden="true" className="text-[#3D261C]/25">
                ·
              </span>
              <span>
                {store?.address || '소노벨 영덕'}
              </span>
              <span aria-hidden="true" className="text-[#3D261C]/25">
                ·
              </span>
              <a
                href={`tel:${(store?.phone || '010-0000-0000').replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1 tabular-nums hover:text-[#D65718] underline-offset-4 hover:underline"
              >
                <Phone className="h-3.5 w-3.5 text-[#D65718]" />
                <span>{store?.phone || '010-0000-0000'}</span>
              </a>
            </div>
            <p className="text-[11px] text-[#3D261C]/60">
              © {new Date().getFullYear()} {brandName}. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <a
              href={store?.youtubeUrl || 'https://www.youtube.com'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="유튜브 바로가기"
              title="유튜브 바로가기"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#3D261C]/12 bg-white px-3 py-1.5 text-xs font-medium text-[#3D261C] hover:border-[#FF0000]/40 hover:text-[#CC0000] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 text-[#FF0000]"
                fill="currentColor"
              >
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>YouTube</span>
            </a>

            <a
              href="/staff/coupons"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/staff/coupons');
              }}
              className="hover:text-[#D65718] underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              직원 쿠폰 관리
            </a>
          </div>
        </div>
      </footer>

      {/* 하단 고정 쿠폰 버튼: 첫 화면 버튼이 안 보이고 쿠폰 창이 닫혀 있을 때만 노출 */}
      {showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3D261C]/12 bg-[#FFFBF4]/95 backdrop-blur-sm px-4 py-2.5 sm:py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="hidden sm:block min-w-0">
              <p className="text-xs font-bold text-[#3D261C] truncate">
                유기농 당근케이크 구매 시 아메리카노 1잔 무료
              </p>
              <p className="text-[11px] text-[#3D261C]/70 truncate">
                {brandName} 첫 방문 고객 선물
              </p>
            </div>
            <button
              ref={stickyCtaRef}
              type="button"
              disabled={isCouponActionDisabled}
              onClick={() => handleOpenOrIssueCoupon(stickyCtaRef.current)}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D65718] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#B5430F] disabled:bg-[#3D261C]/25 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
            >
              <Ticket className="h-4 w-4 shrink-0" />
              <span>{ctaLabel}</span>
            </button>
          </div>
        </div>
      )}

      <CouponModal
        isOpen={isModalOpen}
        coupon={coupon}
        isLoading={isIssuing}
        isRefreshing={isRefreshing}
        errorMessage={modalError}
        onClose={() => setIsModalOpen(false)}
        onRefresh={handleRefreshCoupon}
        returnFocusRef={lastTriggerRef}
      />
    </div>
  );
}

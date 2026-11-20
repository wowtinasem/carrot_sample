import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { StorePlaceDetails } from '../shared/types.ts';

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void;
  addControl(control: unknown, position: unknown): void;
}

interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
}

interface KakaoCustomOverlayInstance {
  setMap(map: KakaoMapInstance | null): void;
}

interface KakaoMapsNamespace {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  Marker: new (options: {
    position: KakaoLatLng;
    title?: string;
  }) => KakaoMarkerInstance;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: string;
    yAnchor?: number;
  }) => KakaoCustomOverlayInstance;
  ZoomControl: new () => unknown;
  MapTypeControl: new () => unknown;
  ControlPosition: {
    TOPRIGHT: unknown;
    RIGHT: unknown;
  };
  services?: {
    Status: { OK: string };
    Places: new () => {
      keywordSearch(
        keyword: string,
        callback: (
          result: Array<{ x: string; y: string; place_name?: string }>,
          status: string,
        ) => void,
      ): void;
    };
  };
}

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMapsNamespace;
    };
  }
}

let kakaoSdkLoadPromise: Promise<KakaoMapsNamespace> | null = null;

function loadKakaoMapsSdk(appKey: string): Promise<KakaoMapsNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser environment required'));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao!.maps!.load(() => resolve(window.kakao!.maps!));
    });
  }

  if (kakaoSdkLoadPromise) {
    return kakaoSdkLoadPromise;
  }

  kakaoSdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey,
    )}&autoload=false&libraries=services`;
    script.onload = () => {
      if (!window.kakao?.maps) {
        kakaoSdkLoadPromise = null;
        reject(new Error('Kakao Maps SDK unavailable'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps!));
    };
    script.onerror = () => {
      kakaoSdkLoadPromise = null;
      reject(new Error('Failed to load Kakao Maps SDK'));
    };
    document.head.appendChild(script);
  });

  return kakaoSdkLoadPromise;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface StoreLocationMapProps {
  kakaoAppKey: string;
  brandName: string;
  storeAddress: string;
  place: StorePlaceDetails | null;
  isLoading: boolean;
  directionsHref: string;
  shortcutHref: string;
}

export function StoreLocationMap({
  kakaoAppKey,
  brandName,
  storeAddress,
  place,
  isLoading,
  directionsHref,
  shortcutHref,
}: StoreLocationMapProps) {
  const sdkContainerRef = useRef<HTMLDivElement | null>(null);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const shouldUseSdk = Boolean(kakaoAppKey) && !sdkFailed;

  useEffect(() => {
    if (!shouldUseSdk || isLoading) return;

    let cancelled = false;
    setSdkReady(false);

    loadKakaoMapsSdk(kakaoAppKey)
      .then((maps) => {
        if (cancelled || !sdkContainerRef.current) return;

        const renderMap = (lat: number, lng: number) => {
          if (cancelled || !sdkContainerRef.current) return;
          const center = new maps.LatLng(lat, lng);
          const map = new maps.Map(sdkContainerRef.current, {
            center,
            level: 4,
          });
          map.addControl(new maps.MapTypeControl(), maps.ControlPosition.TOPRIGHT);
          map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);

          const marker = new maps.Marker({
            position: center,
            title: `${brandName} (${storeAddress})`,
          });
          marker.setMap(map);

          const safeBrand = escapeHtml(brandName);
          const safeAddr = escapeHtml(place?.formattedAddress || storeAddress);
          const overlayHtml = `
            <div style="background:#FFFBF4;border:1.5px solid #D65718;border-radius:14px;padding:8px 12px;box-shadow:0 6px 18px rgba(61,38,28,0.14);font-family:'Noto Sans KR',sans-serif;min-width:140px;max-width:220px;">
              <div style="font-weight:800;font-size:13px;color:#D65718;line-height:1.2;">${safeBrand}</div>
              <div style="font-size:11px;color:#3D261C;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeAddr}</div>
            </div>
          `;
          const overlay = new maps.CustomOverlay({
            position: center,
            content: overlayHtml,
            yAnchor: 1.55,
          });
          overlay.setMap(map);
          setSdkReady(true);
        };

        if (place?.location) {
          renderMap(place.location.lat, place.location.lng);
          return;
        }

        if (maps.services) {
          const ps = new maps.services.Places();
          ps.keywordSearch(storeAddress, (result, status) => {
            if (cancelled) return;
            if (status === maps.services?.Status.OK && result[0]) {
              const lat = Number(result[0].y);
              const lng = Number(result[0].x);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                renderMap(lat, lng);
                return;
              }
            }
            setSdkFailed(true);
          });
        } else {
          setSdkFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSdkFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldUseSdk, kakaoAppKey, isLoading, place, brandName, storeAddress]);

  if (isLoading) {
    return (
      <div className="h-[300px] sm:h-[360px] w-full rounded-2xl border border-[#3D261C]/12 bg-[#FFF3E3]/60 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-7 w-7 rounded-full border-2 border-[#D65718] border-t-transparent animate-spin" />
        <p className="mt-3 text-xs sm:text-sm font-medium text-[#3D261C]/75">
          {storeAddress} 카카오맵을 불러오고 있어요…
        </p>
      </div>
    );
  }

  if (shouldUseSdk) {
    return (
      <div className="relative h-[300px] sm:h-[360px] w-full overflow-hidden rounded-2xl border border-[#3D261C]/12 bg-[#FFF3E3]">
        {!sdkReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FFF3E3]/80 p-6 text-center">
            <div className="h-7 w-7 rounded-full border-2 border-[#D65718] border-t-transparent animate-spin" />
            <p className="mt-3 text-xs sm:text-sm font-medium text-[#3D261C]/75">
              카카오맵을 불러오고 있어요…
            </p>
          </div>
        )}
        <div ref={sdkContainerRef} className="h-full w-full" />
      </div>
    );
  }

  const embedUrl = place?.location
    ? `https://map.kakao.com/link/map/${encodeURIComponent(
        `${brandName} (${storeAddress})`,
      )},${place.location.lat},${place.location.lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(storeAddress)}`;

  return (
    <div className="relative h-[300px] sm:h-[360px] w-full overflow-hidden rounded-2xl border border-[#3D261C]/12 bg-[#FFF3E3]">
      {!iframeLoaded && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FFF3E3]/85 p-6 text-center space-y-2">
          <div className="h-10 w-10 rounded-2xl bg-[#FFEEDB] border border-[#D65718]/20 flex items-center justify-center text-[#D65718]">
            <MapPin className="h-5 w-5" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-[#3D261C]">
            {storeAddress} 카카오맵 불러오는 중…
          </p>
        </div>
      )}

      <iframe
        title={`${brandName} 카카오맵 (${storeAddress})`}
        src={embedUrl}
        onLoad={() => setIframeLoaded(true)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-0"
      />

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-[#FEE500] px-3 py-1.5 text-xs font-bold text-[#191919] shadow-sm border border-[#191919]/10 hover:bg-[#F5DC00] transition-colors"
        >
          <span>카카오맵 길찾기</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <a
          href={shortcutHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#3D261C] shadow-sm border border-[#3D261C]/15 hover:text-[#D65718] transition-colors"
        >
          <span>크게 보기</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

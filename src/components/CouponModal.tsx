import { useEffect, useRef, type RefObject } from 'react';
import { CheckCircle2, Clock, RefreshCw, X } from 'lucide-react';
import type { CustomerCouponDTO } from '../shared/types.ts';
import { formatKstDateTime } from '../lib/formatters.ts';
import { BarcodeView } from './BarcodeView.tsx';

interface CouponModalProps {
  isOpen: boolean;
  coupon: CustomerCouponDTO | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRefresh: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function CouponModal({
  isOpen,
  coupon,
  isLoading,
  isRefreshing,
  errorMessage,
  onClose,
  onRefresh,
  returnFocusRef,
}: CouponModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const timer = window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 10);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key === 'Tab' && dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (
              document.activeElement === first ||
              !dialogRef.current.contains(document.activeElement)
            ) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (
              document.activeElement === last ||
              !dialogRef.current.contains(document.activeElement)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      returnFocusRef.current?.focus();
    }
  }, [isOpen, onClose, returnFocusRef]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3D261C]/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-modal-title"
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFBF4] text-[#3D261C] border border-[#3D261C]/12 shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-[#3D261C]/15 bg-[#FFEEDB]/80">
          <div>
            <p className="text-xs font-medium text-[#B5430F]">
              당근카페 첫 방문 선물
              {coupon?.isTest ? ' · 테스트 행사 쿠폰' : ''}
            </p>
            <h2
              id="coupon-modal-title"
              className="font-display mt-0.5 text-xl text-[#3D261C]"
            >
              {coupon?.status === 'used'
                ? '쿠폰 사용 내역'
                : coupon?.status === 'expired'
                  ? '만료된 쿠폰'
                  : '첫 방문 바코드 쿠폰'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="쿠폰 창 닫기"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#3D261C] hover:bg-[#3D261C]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="py-10 text-center space-y-2.5">
              <div className="mx-auto h-7 w-7 rounded-full border-2 border-[#D65718] border-t-transparent animate-spin" />
              <p className="text-sm text-[#3D261C]/75">쿠폰을 준비하고 있어요…</p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl bg-white p-4 border border-[#D65718]/30 text-sm text-[#3D261C]">
              <p className="font-medium text-[#B5430F]">{errorMessage}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full min-h-[44px] rounded-xl bg-[#D65718] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B5430F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718]"
              >
                확인
              </button>
            </div>
          ) : coupon ? (
            <>
              <div className="rounded-2xl bg-[#EFF6E9] px-4 py-3.5 border border-[#46733D]/15">
                <p className="text-sm font-bold text-[#355E2D]">
                  {coupon.benefitText}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#3D261C]/80">
                  {coupon.conditionText}
                </p>
              </div>

              {coupon.status === 'unused' && (
                <div className="space-y-3">
                  <BarcodeView code={coupon.code} />
                  <p className="text-center text-sm font-semibold text-[#B5430F]">
                    카운터에서 이 바코드를 보여주세요
                  </p>
                </div>
              )}

              {coupon.status === 'used' && (
                <div className="rounded-2xl bg-white px-4 py-6 border border-[#3D261C]/12 text-center space-y-2">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-[#46733D]" />
                  <p className="font-display text-lg text-[#3D261C]">사용 완료</p>
                  <p className="text-xs text-[#3D261C]/75 tabular-nums">
                    사용일시: {formatKstDateTime(coupon.usedAt)}
                  </p>
                  <p className="pt-1 font-mono-code text-xs text-[#3D261C]/55">
                    쿠폰 번호: {coupon.code}
                  </p>
                </div>
              )}

              {coupon.status === 'expired' && (
                <div className="rounded-2xl bg-white px-4 py-6 border border-[#D65718]/30 text-center space-y-2">
                  <Clock className="mx-auto h-9 w-9 text-[#D65718]" />
                  <p className="font-display text-lg text-[#3D261C]">기간 만료</p>
                  <p className="text-xs text-[#3D261C]/75 tabular-nums">
                    만료일시: {formatKstDateTime(coupon.expiresAt)}
                  </p>
                  <p className="pt-1 font-mono-code text-xs text-[#3D261C]/55">
                    쿠폰 번호: {coupon.code}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-[#3D261C]/15 text-xs text-[#3D261C]/75 tabular-nums">
                <span>유효기간: {formatKstDateTime(coupon.expiresAt)}까지</span>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1 font-medium text-[#B5430F] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  상태 새로고침
                </button>
              </div>

              {coupon.isTest && (
                <p className="text-[11px] text-[#3D261C]/60 leading-snug">
                  미리보기 테스트 행사에서 발급된 쿠폰입니다. 운영 통계에는 집계되지 않습니다.
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-2xl bg-[#D65718] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B5430F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65718] transition-colors"
              >
                닫기
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

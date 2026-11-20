import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeViewProps {
  code: string;
}

export function BarcodeView({ code }: BarcodeViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        lineColor: '#000000',
        background: '#FFFFFF',
        width: 2,
        height: 76,
        margin: 16,
        displayValue: false,
      });
    } catch {
      // Fallback handled by readable text code below
    }
  }, [code]);

  return (
    <div
      className="w-full rounded-2xl bg-white px-5 py-4 border border-[#3D261C]/12 flex flex-col items-center justify-center"
      aria-label={`쿠폰 바코드 ${code}`}
    >
      <svg
        ref={svgRef}
        className="w-full max-w-[300px] h-auto"
        role="img"
        aria-label={`Code 128 바코드 ${code}`}
      />
      <p className="mt-2 font-mono-code text-base font-semibold tracking-[0.18em] text-[#000000] select-all">
        {code}
      </p>
    </div>
  );
}

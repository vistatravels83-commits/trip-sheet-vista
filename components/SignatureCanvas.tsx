import React, { useRef, useImperativeHandle, forwardRef, memo, useEffect, useState } from 'react';
import SignaturePad from 'react-signature-canvas';

interface Props {
  onEnd?: () => void;
  onBegin?: () => void;
}

export interface SignatureRef {
  clear: () => void;
  getTrimmedCanvas: () => HTMLCanvasElement;
  isEmpty: () => boolean;
}

const SignatureCanvas = forwardRef<SignatureRef, Props>(({ onEnd, onBegin }, ref) => {
  const sigPad = useRef<SignaturePad>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  // Set initial canvas size once on mount to match container
  // This prevents clearing on mobile scroll which often triggers "resize" when URL bar hides/shows
  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setCanvasSize({ width: offsetWidth, height: offsetHeight || 160 });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => sigPad.current?.clear(),
    getTrimmedCanvas: () => {
      try {
        return sigPad.current?.getTrimmedCanvas() as HTMLCanvasElement;
      } catch (e) {
        console.warn('Trim failed, fallback to raw canvas:', e);
        return sigPad.current?.getCanvas() as HTMLCanvasElement;
      }
    },
    isEmpty: () => sigPad.current?.isEmpty() ?? true,
  }), []);

  return (
    <div
      ref={containerRef}
      className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white touch-none relative min-h-[160px]"
    >
      <SignaturePad
        ref={sigPad}
        canvasProps={{
          className: 'signature-canvas block',
          // Use fixed dimensions if calculated, otherwise fallback to CSS
          // This stops the canvas from clearing itself when the browser detects CSS layout changes during scroll
          width: canvasSize?.width,
          height: canvasSize?.height,
          style: { width: '100%', height: '160px' }
        }}
        {...({ onEnd, onBegin } as any)}
      />
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

// memo(..., () => true) ensures this component NEVER re-renders from parent changes.
// The internal canvasSize state is only set once on mount.
export default memo(SignatureCanvas, () => true);


import React, { useRef, useImperativeHandle, forwardRef, memo } from 'react';
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

  useImperativeHandle(ref, () => ({
    clear: () => sigPad.current?.clear(),
    getTrimmedCanvas: () => sigPad.current?.getTrimmedCanvas() as HTMLCanvasElement,
    isEmpty: () => sigPad.current?.isEmpty() ?? true,
  }), []);

  return (
    <div className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white touch-none relative min-h-[160px]">
      {/* 
          Fix: Passed onEnd and onBegin to SignaturePad. 
          If the type definitions are outdated or incomplete, 
          using type casting to 'any' ensures the underlying JS props are passed.
      */}
      <SignaturePad
        ref={sigPad}
        canvasProps={{
          className: 'signature-canvas w-full h-40 block',
          style: { width: '100%', height: '160px' }
        }}
        {...({ onEnd, onBegin } as any)}
      />
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

// Using memo with a true return to ensure this component NEVER re-renders 
// due to parent state changes (like validation errors in other fields).
// The signature pad manages its own internal canvas state.
export default memo(SignatureCanvas, () => true);

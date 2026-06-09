"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface Props {
  text: string;
}

export default function InfoTooltip({ text }: Props) {
  const [show,    setShow]    = useState(false);
  const [pos,     setPos]     = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  function handleEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top + window.scrollY - 6, left: r.left + r.width / 2 });
    }
    setShow(true);
  }

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onFocus={handleEnter}
        onBlur={() => setShow(false)}
        className="text-[var(--text-3)] hover:text-blue-400 transition-colors focus:outline-none ml-0.5"
        aria-label={text}
      >
        <Info size={9} />
      </button>

      {show && mounted && createPortal(
        <div
          className="fixed z-[9999] w-52 px-3 py-2 bg-[#0a1525] border border-[#1a3050] rounded-lg text-[10px] text-slate-300 leading-relaxed shadow-2xl pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#1a3050]"
            aria-hidden
          />
        </div>,
        document.body,
      )}
    </span>
  );
}

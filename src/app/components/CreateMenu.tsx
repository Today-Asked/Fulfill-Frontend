import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ImagePlus, Send } from "lucide-react";

interface CreateMenuProps {
  /** Renders the trigger's visuals; receives whether the menu is open (e.g. to rotate a "+" into an "×"). */
  trigger: (open: boolean) => React.ReactNode;
  /** Which side of the trigger the menu opens toward. */
  direction?: "down" | "up";
  /** Which edge of the trigger the menu hangs from, or centered under/over it. */
  align?: "start" | "end" | "center";
  className?: string;
}

const GAP = 8;

/**
 * Shared "+" entry point for TopNav and BottomNav. Dims the whole screen and
 * offers "新增委託" (go find a creator to invite) or "新增作品" (the upload form).
 *
 * Portaled to <body>: both nav bars sit inside a `backdrop-blur` container,
 * which becomes the containing block for fixed/absolute descendants — a
 * plain `fixed inset-0` backdrop nested in there would be clipped to the
 * nav bar's own small box instead of covering the viewport. Portaling out
 * avoids that entirely.
 */
export function CreateMenu({ trigger, direction = "down", align = "end", className = "" }: CreateMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: direction === "down" ? rect.bottom + GAP : undefined,
        bottom: direction === "up" ? window.innerHeight - rect.top + GAP : undefined,
        left: align === "start" ? rect.left : align === "center" ? rect.left + rect.width / 2 : undefined,
        right: align === "end" ? window.innerWidth - rect.right : undefined,
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, direction, align]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="新增"
        className={className}
      >
        {trigger(open)}
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100] bg-black/60"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
              className={`z-[101] w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl shadow-black/60 ${
                align === "center" ? "-translate-x-1/2" : ""
              }`}
            >
              <button
                role="menuitem"
                onClick={() => go("/invite")}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                <Send size={16} className="text-white/50" />
                新增委託
              </button>
              <div className="h-px bg-white/8" />
              <button
                role="menuitem"
                onClick={() => go("/create")}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                <ImagePlus size={16} className="text-white/50" />
                新增作品
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

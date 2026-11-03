import { useEffect, useRef } from "react";

// Accessible modal: closes with Esc or a click outside, focuses the first field when it opens,
// labelled for screen readers.
export default function Modal({ open, onClose, title, children, wide, small }) {
  const box = useRef(null);

  // Parents usually pass an inline function  onClose={() => setOpen(false)}  which is a NEW function
  // on every render. If the effect below depended on it, the effect would re-run after every keystroke
  // and steal the focus from the input being typed in. So we keep the latest onClose in a ref instead.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // runs ONLY when the modal opens or closes (not on every re-render)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement;
    // focus the first form field once, when the modal opens (or the box itself if it has none)
    const first = box.current?.querySelector("input, textarea, select");
    (first || box.current)?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${wide ? "wide" : ""} ${small ? "small" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={box}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

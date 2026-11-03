import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";

// Toast messages + a promise-based confirm dialog:   if (await confirm({...})) { ... }
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  toast.error = (m) => toast(m, "error");

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog(opts);
      }),
    []
  );

  function answer(value) {
    resolver.current?.(value);
    setDialog(null);
  }

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
      <Modal open={Boolean(dialog)} onClose={() => answer(false)} title={dialog?.title || "Are you sure?"} small>
        <p>{dialog?.message}</p>
        <div className="row end gap">
          <button className="btn ghost" onClick={() => answer(false)}>Cancel</button>
          <button className={`btn ${dialog?.danger ? "danger" : ""}`} onClick={() => answer(true)}>
            {dialog?.confirmText || "Confirm"}
          </button>
        </div>
      </Modal>
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);

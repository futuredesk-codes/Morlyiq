import React, { useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { C } from "../../constants/theme.js";
import { nextId } from "../../utils/id.js";

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, tone = "success") => {
    const id = nextId("toast");
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return { toasts, push };
}

export function ToastStack({ toasts = [] }) {
  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 999,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="transition-all transform animate-slide-up"
          style={{
            background:
              t.tone === "danger"
                ? C.danger
                : t.tone === "warn"
                ? C.warn
                : C.navy,
            color: "#fff",
            padding: "11px 16px",
            borderRadius: 10,
            fontFamily: "Inter, sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            boxShadow: "0 10px 30px rgba(11,59,140,0.25)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 220,
          }}
        >
          {t.tone === "danger" ? (
            <AlertTriangle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}

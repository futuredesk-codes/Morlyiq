import React, { useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../../constants/theme.js";
import { Btn, IconBtn } from "./Button.jsx";

export function Modal({ title, onClose, children, width = 560, footer }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[200] overflow-y-auto animate-fade-in"
      style={{ background: "rgba(11,27,51,0.45)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl flex flex-col shadow-modal w-full"
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "88vh",
          boxShadow: "0 30px 80px rgba(11,27,51,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 22px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 16.5,
              fontWeight: 700,
              color: C.text,
            }}
          >
            {title}
          </div>
          <IconBtn icon={X} onClick={onClose} />
        </div>
        <div style={{ padding: 22, overflowY: "auto" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Btn variant="outline" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn
            onClick={onConfirm}
            style={{
              background: tone === "danger" ? C.danger : C.blue,
              color: "#fff",
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          color: C.text,
          lineHeight: 1.6,
        }}
      >
        {message}
      </div>
    </Modal>
  );
}

import React from "react";
import { X } from "lucide-react";
import { IconBtn, Btn } from "./Button";

export function Modal({ title, onClose, children, width = 560, footer }) {
  return (
    <div
      className="fixed inset-0 bg-[#0B1B33]/45 flex items-center justify-center z-[200] p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[16px] w-full max-h-[88vh] flex flex-col shadow-modal"
        style={{ maxWidth: typeof width === "number" ? `${width}px` : width }}
      >
        <div className="flex justify-between items-center px-4 sm:px-[22px] py-3.5 sm:py-[18px] border-b border-brand-border">
          <div className="font-sans text-[16.5px] font-bold text-brand-text truncate pr-2">
            {title}
          </div>
          <IconBtn icon={X} onClick={onClose} />
        </div>
        <div className="p-4 sm:p-[22px] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-4 sm:px-[22px] py-3 sm:py-[14px] border-t border-brand-border flex justify-end gap-2.5 flex-wrap">
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
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div className="font-sans text-[14px] text-brand-text leading-[1.6]">
        {message}
      </div>
    </Modal>
  );
}

/*
 * Prism Window Manager (@prism-wm), React adapter
 * Copyright (C) 2023-2026 Banshee Technologies S.L.
 * Authors: Claudio González, Néstor González
 * https://www.banshee.pro/
 *
 * Extracted from HomeDock OS: https://github.com/BansheeTech/HomeDockOS
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PWM_EXTERNAL_DIALOG_APP_ID, type DialogModality, type WindowManagerStore } from "@prism-wm/core";

import { EMPTY_CLASSES, cx, useOptionalPrismContext, type PrismClassMap } from "./context";

export interface PrismDialogProps {
  store?: WindowManagerStore;
  classes?: Partial<PrismClassMap>;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  title?: string;
  icon?: unknown;
  width?: number;
  modality?: DialogModality;
  ownerId?: string;
  maskClosable?: boolean;
  okText?: string;
  cancelText?: string;
  dismissText?: string;
  okCancel?: boolean;
  okDisabled?: boolean;
  okDanger?: boolean;
  loading?: boolean;
  reverseButtons?: boolean;
  closeOnOk?: boolean;
  footer?: ReactNode | false;
  onOk?: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
  children?: ReactNode;
}

export function PrismDialog({ store: storeProp, classes, visible = false, onVisibleChange, title = "", icon = null, width = 420, modality = "app", ownerId, maskClosable = false, okText = "OK", cancelText = "Cancel", dismissText = "", okCancel = true, okDisabled = false, okDanger = false, loading = false, reverseButtons = false, closeOnOk = true, footer, onOk, onCancel, onDismiss, children }: PrismDialogProps) {
  const ctx = useOptionalPrismContext();
  const store = storeProp ?? ctx?.store ?? null;
  const cls: PrismClassMap = { ...EMPTY_CLASSES, ...(ctx?.classes ?? {}), ...(classes ?? {}) };

  const [mount, setMount] = useState<HTMLElement | null>(null);

  const windowId = useRef<string | null>(null);

  const latest = useRef({ onVisibleChange, onCancel });
  latest.current = { onVisibleChange, onCancel };

  const close = useCallback(() => {
    const id = windowId.current;
    if (!id || !store) return;
    windowId.current = null;
    setMount(null);
    store.beginClose(id);
  }, [store]);

  useEffect(() => {
    if (!visible || !store || windowId.current) return;

    const id = store.openDialog(PWM_EXTERNAL_DIALOG_APP_ID, {
      external: true,
      title,
      icon,
      width,
      modality,
      ownerId,
      maskClosable,
      onResult: () => {
        if (!windowId.current) return;
        windowId.current = null;
        setMount(null);
        latest.current.onCancel?.();
        latest.current.onVisibleChange?.(false);
      },
    });
    windowId.current = id;

    const raf = requestAnimationFrame(() => {
      if (windowId.current !== id) return;
      setMount(document.querySelector<HTMLElement>(`[data-pwm-slot="${id}"]`));
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, store]);

  useEffect(() => {
    if (!visible) close();
  }, [visible, close]);

  useEffect(() => {
    if (windowId.current && store) store.updateWindowTitle(windowId.current, title);
  }, [title, store]);

  useEffect(() => close, [close]);

  if (!mount) return null;

  const handleOk = () => {
    onOk?.();
    if (closeOnOk) {
      close();
      onVisibleChange?.(false);
    }
  };

  const handleCancel = () => {
    close();
    onCancel?.();
    onVisibleChange?.(false);
  };

  const handleDismiss = () => {
    close();
    onDismiss?.();
    onVisibleChange?.(false);
  };

  const builtInFooter = (
    <div className={cx("pwm-dialog-footer", reverseButtons && "pwm-dialog-footer-reversed", cls.dialogFooter)}>
      {okCancel ? (
        <button type="button" className={cx("pwm-dialog-btn", cls.dialogButton)} onClick={handleCancel}>
          {cancelText}
        </button>
      ) : null}

      {dismissText ? (
        <button type="button" className={cx("pwm-dialog-btn", cls.dialogButton)} onClick={handleDismiss}>
          {dismissText}
        </button>
      ) : null}

      <button type="button" className={cx("pwm-dialog-btn", okDanger ? cls.dialogButtonDanger : cls.dialogButtonPrimary, loading && "pwm-dialog-btn-loading")} disabled={loading || okDisabled} onClick={handleOk}>
        {loading ? <span className="pwm-dialog-spinner" aria-hidden="true" /> : <span>{okText}</span>}
      </button>
    </div>
  );

  return createPortal(
    <>
      {children}
      {footer === undefined ? builtInFooter : footer === false ? null : footer}
    </>,
    mount,
  );
}

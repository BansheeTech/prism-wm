/*
 * Prism Window Manager (@prism-wm), React adapter tests
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
 *
 * <PrismDialog>: a dialog declared in a parent's tree, whose content stays in
 * that parent's scope. Mirror of the Vue suite: the point is that the children
 * really are the parent's (they see the parent's state) and that every route out
 * of the dialog agrees with the parent's `visible`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { PrismWindowManager } from "../src/PrismWindowManager";
import { PrismDialog } from "../src/PrismDialog";
import { createWindowManager } from "../src/useWindowManager";
import { PWM_CLOSE_ANIMATION_MS, type WindowManagerStore } from "@prism-wm/core";

const last = <T,>(a: T[]): T | undefined => a[a.length - 1];

const VP = { getViewport: () => ({ width: 1024, height: 768 }) };

afterEach(cleanup);

async function flushClose() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, PWM_CLOSE_ANIMATION_MS + 30));
  });
}

async function settle() {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

describe("PrismDialog", () => {
  let store: WindowManagerStore;
  const events: string[] = [];

  beforeEach(() => {
    store = createWindowManager(VP);
    events.length = 0;
  });

  function Host({ initiallyVisible = false, dialogProps = {} }: { initiallyVisible?: boolean; dialogProps?: Record<string, unknown> }) {
    const [visible, setVisible] = useState(initiallyVisible);
    const [name, setName] = useState("Documents");

    return (
      <>
        <button className="open" onClick={() => setVisible(true)} />
        <button className="rename" onClick={() => setName("Pictures")} />
        <PrismWindowManager store={store} resolveComponent={() => null} />
        <PrismDialog store={store} visible={visible} onVisibleChange={setVisible} onOk={() => events.push("ok")} onCancel={() => events.push("cancel")} onDismiss={() => events.push("dismiss")} {...dialogProps}>
          <p className="body">{name}</p>
        </PrismDialog>
      </>
    );
  }

  it("opens no window until visible turns true", async () => {
    const { container } = render(<Host />);
    expect(store.getState().windows).toHaveLength(0);

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".open")?.click();
    });
    await settle();
    expect(store.getState().windows).toHaveLength(1);
  });

  it("opens a dialog, not a plain window", async () => {
    render(<Host initiallyVisible dialogProps={{ title: "Rename Folder" }} />);
    await settle();

    const win = store.getState().windows[0];
    expect(win.kind).toBe("dialog");
    expect(win.external).toBe(true);
    expect(win.title).toBe("Rename Folder");
  });

  it("renders the children inside the window body", async () => {
    render(<Host initiallyVisible />);
    await settle();

    const slot = document.querySelector(".pwm-window-slot");
    expect(slot).not.toBeNull();
    expect(slot?.querySelector(".body")?.textContent).toBe("Documents");
  });

  it("keeps the children in the parent's scope, which is the whole point", async () => {
    const { container } = render(<Host initiallyVisible />);
    await settle();
    expect(document.querySelector(".body")?.textContent).toBe("Documents");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".rename")?.click();
    });
    expect(document.querySelector(".body")?.textContent).toBe("Pictures");
  });

  it("never asks resolveComponent for an external dialog", async () => {
    let asked = 0;
    render(
      <>
        <PrismWindowManager
          store={store}
          resolveComponent={() => {
            asked++;
            return null;
          }}
        />
        <PrismDialog store={store} visible>
          <p>x</p>
        </PrismDialog>
      </>,
    );
    await settle();

    expect(store.getState().windows).toHaveLength(1);
    expect(asked).toBe(0);
  });

  describe("the built-in button row", () => {
    const buttons = () => [...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")];

    it("emits ok and closes by default", async () => {
      render(<Host initiallyVisible dialogProps={{ okText: "Rename" }} />);
      await settle();

      const ok = last(buttons());
      expect(ok?.textContent?.trim()).toBe("Rename");
      await act(async () => ok?.click());
      await flushClose();

      expect(events).toEqual(["ok"]);
      expect(store.getState().windows).toHaveLength(0);
    });

    it("stays open on ok when closeOnOk is false", async () => {
      render(<Host initiallyVisible dialogProps={{ closeOnOk: false }} />);
      await settle();

      await act(async () => last(buttons())?.click());

      expect(events).toEqual(["ok"]);
      expect(store.getState().windows).toHaveLength(1);
    });

    it("emits cancel and closes", async () => {
      render(<Host initiallyVisible />);
      await settle();

      await act(async () => buttons()[0]?.click());
      await flushClose();

      expect(events).toEqual(["cancel"]);
      expect(store.getState().windows).toHaveLength(0);
    });

    it("hides Cancel when okCancel is false", async () => {
      render(<Host initiallyVisible dialogProps={{ okCancel: false }} />);
      await settle();

      expect(buttons()).toHaveLength(1);
    });

    it("disables OK when okDisabled", async () => {
      render(<Host initiallyVisible dialogProps={{ okDisabled: true }} />);
      await settle();

      expect(last(buttons())?.disabled).toBe(true);
    });

    it("flips the row for reverseButtons rather than reordering the DOM", async () => {
      render(<Host initiallyVisible dialogProps={{ reverseButtons: true }} />);
      await settle();

      const footer = document.querySelector(".pwm-dialog-footer");
      expect(footer?.classList.contains("pwm-dialog-footer-reversed")).toBe(true);
      expect(footer?.firstElementChild?.textContent?.trim()).toBe("Cancel");
    });

    it("can be replaced wholesale, or dropped with footer={false}", async () => {
      const { rerender } = render(
        <>
          <PrismWindowManager store={store} resolveComponent={() => null} />
          <PrismDialog store={store} visible footer={<button className="mine">Mine</button>}>
            <p>x</p>
          </PrismDialog>
        </>,
      );
      await settle();
      expect(document.querySelector(".mine")).not.toBeNull();
      expect(document.querySelector(".pwm-dialog-footer")).toBeNull();

      rerender(
        <>
          <PrismWindowManager store={store} resolveComponent={() => null} />
          <PrismDialog store={store} visible footer={false}>
            <p>x</p>
          </PrismDialog>
        </>,
      );
      expect(document.querySelector(".mine")).toBeNull();
      expect(document.querySelector(".pwm-dialog-footer")).toBeNull();
    });
  });

  it("reports a CANCEL when the window is closed from outside", async () => {
    render(<Host initiallyVisible dialogProps={{ dismissText: "Don't Save" }} />);
    await settle();

    await act(async () => {
      store.closeWindow(store.getState().windows[0].id);
    });
    await flushClose();

    expect(events).toEqual(["cancel"]);
    expect(events).not.toContain("dismiss");
  });

  it("reports a dismissal only from the dismiss button", async () => {
    render(<Host initiallyVisible dialogProps={{ dismissText: "Don't Save" }} />);
    await settle();

    const dismiss = [...document.querySelectorAll<HTMLButtonElement>(".pwm-dialog-btn")].find((b) => b.textContent?.trim() === "Don't Save");
    await act(async () => dismiss?.click());
    await flushClose();

    expect(events).toEqual(["dismiss"]);
  });

  it("pushes a title change to the open window", async () => {
    function Stepped() {
      const [title, setTitle] = useState("Step 1");
      return (
        <>
          <button className="next" onClick={() => setTitle("Step 2")} />
          <PrismWindowManager store={store} resolveComponent={() => null} />
          <PrismDialog store={store} visible title={title}>
            <p>x</p>
          </PrismDialog>
        </>
      );
    }
    const { container } = render(<Stepped />);
    await settle();
    expect(store.getState().windows[0].title).toBe("Step 1");

    await act(async () => container.querySelector<HTMLButtonElement>(".next")?.click());
    expect(store.getState().windows[0].title).toBe("Step 2");
  });

  it("closes its window when the parent unmounts", async () => {
    render(<PrismWindowManager store={store} resolveComponent={() => null} />);
    const { unmount } = render(
      <PrismDialog store={store} visible>
        <p>x</p>
      </PrismDialog>,
    );
    await settle();
    expect(store.getState().windows).toHaveLength(1);

    unmount();
    await flushClose();
    expect(store.getState().windows).toHaveLength(0);
  });
});

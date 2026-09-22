import { useEffect, useMemo, useState } from "react";
import { PrismWindowManager, createWindowManager, useWindowManager } from "@prism-wm/react";
import "@prism-wm/styles/prism.css";
import "./dock.css";
import logo from "../../../assets/prism-wm-logo-128.webp";
import { AboutApp } from "./AboutApp";

function DemoApp({ message, _windowId, answer, onAsk }: { message?: string; _windowId?: string; answer?: string; onAsk?: (ownerId: string, modality: "app" | "window") => void }) {
  return (
    <div className="demo-body">
      <div>
        <h3>Prism window</h3>
        <p>{message}</p>
      </div>
      <div>
        <p className="demo-label">Confirm dialog</p>
        <div className="demo-ask-row">
          <button className="demo-btn" onClick={() => onAsk?.(_windowId!, "app")}>
            Block the app
          </button>
          <button className="demo-btn" onClick={() => onAsk?.(_windowId!, "window")}>
            Block this window
          </button>
          {answer && (
            <span className="demo-answer">
              Answered <code>{answer}</code>
            </span>
          )}
        </div>
      </div>
      <ul className="demo-hints">
        <li>
          <b>Drag</b> the title bar
        </li>
        <li>
          <b>Resize</b> from any edge
        </li>
        <li>
          <b>Double-click</b> to maximize
        </li>
        <li>
          <b>Drag to an edge</b> to snap
        </li>
      </ul>
    </div>
  );
}

function HeavyApp({ rows = 600 }: { rows?: number }) {
  return (
    <div className="heavy-grid">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="heavy-cell">
          <span>#{i}</span>
          <span>payload-item-{i}.dat</span>
          <span>{(i * 37) % 999} KB</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ _windowId, onPick }: { _windowId?: string; onPick?: (dialogId: string, value: string) => void }) {
  const pick = (v: string) => onPick?.(_windowId!, v);
  return (
    <div className="demo-confirm">
      <p>Everything you typed will be lost.</p>
      <div className="demo-confirm-actions">
        <button className="demo-btn ghost" onClick={() => pick("cancel")}>
          Cancel
        </button>
        <button className="demo-btn" onClick={() => pick("no")}>
          No
        </button>
        <button className="demo-btn primary" onClick={() => pick("yes")}>
          Yes
        </button>
      </div>
    </div>
  );
}

const DOCK_HEIGHT = 64;

type Appearance = "redmond" | "cupertino";
const LOOKS: { id: Appearance; label: string }[] = [
  { id: "redmond", label: "Redmond" },
  { id: "cupertino", label: "Cupertino" },
];

export function App() {
  const store = useMemo(() => createWindowManager({ taskbarHeight: DOCK_HEIGHT }), []);

  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const state = useWindowManager(store);
  const minimized = state.windows.filter((w) => w.isMinimized);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const ask = (ownerId: string, modality: "app" | "window") => {
    store.openDialog("confirm", {
      title: "Discard changes?",
      ownerId,
      modality,
      width: 380,
      data: { ownerId },
      maskClosable: true,
      dismissValue: "cancel",
      onResult: (value) => setAnswers((prev) => ({ ...prev, [ownerId]: String(value) })),
    });
  };

  const [appearance, setAppearance] = useState<Appearance>("redmond");

  const resolve = (win: { appId: string }) => (win.appId === "about" ? AboutApp : win.appId === "heavy" ? HeavyApp : win.appId === "confirm" ? (props: Record<string, unknown>) => <ConfirmDialog {...props} onPick={(dialogId, value) => store.resolveDialog(dialogId, value)} /> : (props: Record<string, unknown>) => <DemoApp {...props} answer={answers[(props as { _windowId?: string })._windowId ?? ""]} onAsk={ask} />);

  const open = () => {
    const n = store.windows.length + 1;
    store.openWindow("demo", {
      title: `Demo Window ${n}`,
      allowMultiple: true,
      width: 460,
      height: 320,
      data: { message: `This is window #${n}, rendered by @prism-wm/react.` },
    });
  };

  const openHeavy = () => {
    const n = store.windows.length + 1;
    store.openWindow("heavy", {
      title: `Heavy Window ${n}`,
      allowMultiple: true,
      width: 620,
      height: 460,
      data: { rows: 600 },
    });
  };

  const openAbout = () => {
    store.openWindow("about", { title: "About Prism", width: 480, height: 600 });
  };

  useMemo(() => {
    open();
    open();
  }, []);

  return (
    <>
      <PrismWindowManager store={store} appearance={appearance} resolveComponent={resolve} isMobile={isMobile} taskbarHeight={DOCK_HEIGHT} />

      <nav className="demo-bar" aria-label="Demo">
        <div className="demo-brand">
          <img className="demo-mark" src={logo} alt="" />
          <span className="demo-pkg">
            <span className="demo-scope">@prism-wm/</span>react
          </span>
        </div>
        <span className="demo-sep" />
        <button className="demo-btn primary" onClick={open}>
          New window
        </button>
        <button className="demo-btn" title="Opens a window with ~2000 nodes" onClick={openHeavy}>
          Heavy window
        </button>
        <span className="demo-sep" />
        <div className="demo-seg" role="group" aria-label="Window chrome">
          {LOOKS.map((look) => (
            <button key={look.id} aria-pressed={appearance === look.id} onClick={() => setAppearance(look.id)}>
              {look.label}
            </button>
          ))}
        </div>
        {minimized.length > 0 && (
          <>
            <span className="demo-sep" />
            {minimized.map((win) => (
              <button key={win.id} className="demo-dock-item" title={`Restore ${win.title}`} onClick={() => store.focusWindow(win.id)}>
                <span>{win.title}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <button className="demo-info" title="About & license" aria-label="About and license" onClick={openAbout}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M12.838 17.638q.362-.363.362-.888t-.362-.888t-.888-.362t-.887.363t-.363.887t.363.888t.887.362t.888-.363M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m.1-14.3q.625 0 1.088.4t.462 1q0 .55-.337.975t-.763.8q-.575.5-1.012 1.1t-.438 1.35q0 .35.263.588t.612.237q.375 0 .638-.25t.337-.625q.1-.525.45-.937t.75-.788q.575-.55.988-1.2t.412-1.45q0-1.275-1.037-2.087T12.1 6q-.95 0-1.812.4T8.975 7.625q-.175.3-.112.638t.337.512q.35.2.725.125t.625-.425q.275-.375.688-.575t.862-.2" />
        </svg>
      </button>
    </>
  );
}

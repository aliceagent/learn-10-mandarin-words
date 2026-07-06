"use client";

import { Fragment, useEffect, useRef } from "react";
import { shortcutGroupsFor, type HelpPanelKind } from "@/lib/shortcut-help-logic";

// The keyboard-shortcuts help overlay for the topic page (Sprint 20): a quiet
// "Shortcuts" trigger button plus a "?"-triggered modal listing the shortcuts for
// the active tab. The dialog mechanics (role="dialog", aria-modal, focus trap,
// Escape-to-close, focus restore) are copied verbatim from onboarding.tsx. Content
// comes from the pure shortcut-help-logic model; the parent (TopicApp) owns the
// open state and the active-tab `kind`, and disables the panel shortcuts while
// this is open. English-only — no lang-attribute concerns.

// Elements that can receive keyboard focus inside the modal (matches onboarding.tsx).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** input/textarea/select/contenteditable — the "?" opener must ignore text entry. */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function ShortcutsHelp({
  open,
  onOpen,
  onClose,
  kind,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  kind: HelpPanelKind;
}): React.JSX.Element {
  // Page-level "?" opener. Registered only while closed (the dialog owns the
  // keyboard once open). Shift is REQUIRED for "?" (it's Shift+/), so it is not
  // treated as a blocking modifier — only ctrl/meta/alt are.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    if (open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "?") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      onOpenRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label="Keyboard shortcuts — press question mark to open"
        aria-keyshortcuts="?"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-emerald-300/60 hover:text-white"
      >
        Shortcuts
        <kbd className="kbd" aria-hidden="true">
          ?
        </kbd>
      </button>
      {open ? <ShortcutsDialog onClose={onClose} kind={kind} /> : null}
    </>
  );
}

function ShortcutsDialog({
  onClose,
  kind,
}: {
  onClose: () => void;
  kind: HelpPanelKind;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const groups = shortcutGroupsFor(kind);

  // On open: remember the trigger, move focus into the dialog. On close (any path),
  // restore focus to the trigger. Same as onboarding.tsx.
  useEffect(() => {
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Escape closes; Tab / Shift+Tab are trapped within the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      aria-describedby="shortcuts-help-desc"
      ref={dialogRef}
    >
      <div className="animate-celebrate w-full max-w-lg rounded-3xl border border-white/10 bg-surface p-7 shadow-2xl">
        <h2 id="shortcuts-help-title" className="text-2xl font-semibold tracking-tight text-white">
          Keyboard shortcuts
        </h2>
        <p id="shortcuts-help-desc" className="mt-2 text-sm text-slate-400">
          Press <kbd className="kbd" aria-hidden="true">?</kbd> anywhere on this page to open this
          guide. Shortcuts never fire while you&apos;re typing.
        </p>

        <div className="mt-6 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                {group.title}
              </p>
              <ul className="mt-2 space-y-2">
                {group.rows.map((row) => (
                  <li
                    key={row.description}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      {row.keys.map((key, i) => (
                        <Fragment key={key}>
                          {i > 0 ? (
                            <span className="text-xs text-slate-500">or</span>
                          ) : null}
                          <kbd className="kbd">{key}</kbd>
                        </Fragment>
                      ))}
                    </span>
                    <span className="text-right text-slate-300">{row.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-7">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cta"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

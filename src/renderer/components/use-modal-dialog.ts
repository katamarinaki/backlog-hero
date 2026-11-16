import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

/** Escape closes, focus stays inside, the page behind does not scroll, focus returns on close. */
export const useModalDialog = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const modal = ref.current;
      if (e.key !== 'Tab' || !modal) return;
      const items = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (active === (e.shiftKey ? first : last) || (e.shiftKey && active === modal)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
        return;
      }
      // WebKit skips buttons and links on Tab, so the native move can still land outside.
      setTimeout(() => {
        if (!modal.contains(document.activeElement)) (e.shiftKey ? last : first)?.focus();
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return ref;
};

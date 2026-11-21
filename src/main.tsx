import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface RootErrorState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends Component<{ children: React.ReactNode }, RootErrorState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): RootErrorState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error || 'Unknown error'),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('SADA RootErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="h-full w-full bg-[#070913] text-white flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full rounded-3xl border border-[#D4AF37]/40 bg-[#10162B] p-6 space-y-4 shadow-2xl">
            <h1 className="text-xl font-extrabold text-[#FCE9A6]">صَدَى - SADA</h1>
            <p className="text-sm font-bold text-rose-300">
              حدث خطأ غير متوقع أثناء تشغيل التطبيق
            </p>
            <div
              dir="ltr"
              className="rounded-xl bg-black/45 border border-rose-500/40 p-3 text-left text-xs text-rose-200 break-words"
            >
              {this.state.errorMessage || 'Render initialization error'}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-2xl bg-[#D4AF37] text-[#070913] font-extrabold text-sm cursor-pointer"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function hideNetlifyDrawerBadge() {
  try {
    const selectors = [
      'netlify-drawer',
      '#netlify-drawer',
      '.netlify-drawer',
      '[id*="netlify-drawer"]',
      '[class*="netlify-drawer"]',
      '[data-netlify-deploy-preview]',
      'iframe[id*="netlify"]',
      'iframe[name*="netlify"]',
      'iframe[src*="netlify"]',
      'iframe[title*="Netlify" i]',
    ];

    const hideElement = (el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty('display', 'none', 'important');
      htmlEl.style.setProperty('visibility', 'hidden', 'important');
      htmlEl.style.setProperty('opacity', '0', 'important');
      htmlEl.style.setProperty('pointer-events', 'none', 'important');
      if (!htmlEl.closest('#root')) {
        htmlEl.remove();
      }
    };

    const scan = () => {
      try {
        document.querySelectorAll(selectors.join(',')).forEach(hideElement);

        Array.from(document.body?.children ?? []).forEach((child) => {
          if (child.id === 'root' || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
            return;
          }
          const tag = child.tagName.toLowerCase();
          const id = (child.id || '').toLowerCase();
          const cls = typeof child.className === 'string' ? child.className.toLowerCase() : '';
          const text = (child.textContent || '').toLowerCase();
          const hasShadowNetlify = Boolean(
            child.shadowRoot?.querySelector(
              '[href*="netlify"], [src*="netlify"], [class*="netlify"]'
            )
          );

          if (
            tag.includes('netlify') ||
            id.includes('netlify') ||
            cls.includes('netlify') ||
            text.includes('powered by netlify') ||
            hasShadowNetlify
          ) {
            hideElement(child);
          }
        });
      } catch {
        // ignore selector issues on legacy WebViews
      }
    };

    scan();

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        scan();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    let ticks = 0;
    const timer = window.setInterval(() => {
      scan();
      ticks += 1;
      if (ticks >= 30) {
        window.clearInterval(timer);
      }
    }, 500);
  } catch {
    // ignore DOM observer failure
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideNetlifyDrawerBadge, { once: true });
  } else {
    hideNetlifyDrawerBadge();
  }

  // Prevent pinch-zoom gestures without blocking native touchmove scrolling
  try {
    document.addEventListener(
      'gesturestart',
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  } catch {
    // ignore passive event unsupported error on older WebViews
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    );
  } catch (err) {
    rootEl.innerHTML =
      '<div dir="rtl" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#070913;color:#FCE9A6;font-family:Cairo,sans-serif;text-align:center;"><div><h2 style="margin:0 0 8px;">تعذّر تشغيل صَدَى - SADA</h2><p style="font-size:13px;color:#fca5a5;">' +
      (err instanceof Error ? err.message : String(err)) +
      '</p><button onclick="window.location.reload()" style="margin-top:12px;padding:10px 18px;border-radius:10px;border:none;background:#D4AF37;color:#070913;font-weight:bold;">إعادة المحاولة</button></div></div>';
  }
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function hideNetlifyDrawerBadge() {
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
    document.querySelectorAll(selectors.join(',')).forEach(hideElement);

    // Also inspect top-level body children outside #root for "Powered by Netlify" widgets / shadow hosts
    Array.from(document.body?.children ?? []).forEach((child) => {
      if (child.id === 'root' || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        return;
      }
      const tag = child.tagName.toLowerCase();
      const id = (child.id || '').toLowerCase();
      const cls = typeof child.className === 'string' ? child.className.toLowerCase() : '';
      const text = (child.textContent || '').toLowerCase();
      const hasShadowNetlify = Boolean(
        child.shadowRoot?.querySelector('[href*="netlify"], [src*="netlify"], [class*="netlify"]')
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
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideNetlifyDrawerBadge, {once: true});
  } else {
    hideNetlifyDrawerBadge();
  }
}

createRoot(document.getElementById('root')!).render(<App />);

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function oklchToRgbCss(raw: string): string {
  return raw.replace(/oklch\(\s*([^\s)]+)\s+([^\s)]+)\s+([^\s)/]+)(?:\s*\/\s*([^)]+))?\s*\)/gi, (_m, lStr, cStr, hStr, aStr) => {
    const L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    const C = cStr.endsWith('%') ? (parseFloat(cStr) / 100) * 0.4 : parseFloat(cStr);
    const H = hStr === 'none' ? 0 : parseFloat(hStr);
    if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(H)) return _m;

    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const toSrgb = (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      const encoded =
        clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(encoded * 255)));
    };

    const r = toSrgb(rLin);
    const g = toSrgb(gLin);
    const bl = toSrgb(bLin);

    if (aStr !== undefined) {
      const trimmedA = String(aStr).trim();
      const alpha = trimmedA.endsWith('%') ? parseFloat(trimmedA) / 100 : parseFloat(trimmedA);
      if (Number.isFinite(alpha)) {
        const cleanAlpha = Math.max(0, Math.min(1, alpha));
        return `rgba(${r}, ${g}, ${bl}, ${Number(cleanAlpha.toFixed(4))})`;
      }
    }
    return `rgb(${r}, ${g}, ${bl})`;
  });
}

function unwrapAtBlocks(css: string, matchHeader: (header: string) => boolean): string {
  let out = '';
  let i = 0;
  const n = css.length;

  while (i < n) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n && css[j] !== quote) {
        if (css[j] === '\\') j += 1;
        j += 1;
      }
      out += css.slice(i, Math.min(n, j + 1));
      i = Math.min(n, j + 1);
      continue;
    }

    if (ch === '@') {
      let j = i;
      let parenDepth = 0;
      while (j < n) {
        const cj = css[j];
        if (cj === '(') parenDepth += 1;
        else if (cj === ')' && parenDepth > 0) parenDepth -= 1;
        else if (parenDepth === 0 && (cj === '{' || cj === ';')) break;
        j += 1;
      }
      if (j < n && css[j] === '{') {
        const header = css.slice(i, j).trim();
        if (matchHeader(header)) {
          let depth = 1;
          let k = j + 1;
          while (k < n && depth > 0) {
            const ck = css[k];
            if (ck === '/' && css[k + 1] === '*') {
              const end = css.indexOf('*/', k + 2);
              k = end === -1 ? n : end + 2;
              continue;
            }
            if (ck === '"' || ck === "'") {
              const quote = ck;
              k += 1;
              while (k < n && css[k] !== quote) {
                if (css[k] === '\\') k += 1;
                k += 1;
              }
              k += 1;
              continue;
            }
            if (ck === '{') depth += 1;
            else if (ck === '}') depth -= 1;
            k += 1;
          }
          const inner = css.slice(j + 1, k - 1);
          out += unwrapAtBlocks(inner, matchHeader);
          i = k;
          continue;
        }
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

function unwrapWherePseudo(css: string): string {
  let out = '';
  let i = 0;
  const n = css.length;
  const target = ':where(';

  while (i < n) {
    const idx = css.indexOf(target, i);
    if (idx === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, idx);
    let depth = 1;
    let j = idx + target.length;
    while (j < n && depth > 0) {
      if (css[j] === '(') depth += 1;
      else if (css[j] === ')') depth -= 1;
      j += 1;
    }
    const inner = unwrapWherePseudo(css.slice(idx + target.length, j - 1))
      .replace(/:dir\(rtl\)/g, '[dir="rtl"]')
      .replace(/:dir\(ltr\)/g, '[dir="ltr"]');
    out += inner;
    i = j;
  }

  return out;
}

function transformCssForLegacyMobile(css: string): string {
  const withoutLayerStatements = css.replace(/@layer\s+[^;{]+;/gi, '');
  const unwrappedLayers = unwrapAtBlocks(withoutLayerStatements, (header) => {
    if (/^@layer\s+(properties|theme|base|components|utilities)\b/i.test(header)) {
      return true;
    }
    // Also unwrap Tailwind's @supports fallback around --tw-* property defaults so older WebViews always initialize --tw-* vars
    if (header.startsWith('@supports') && header.includes('-webkit-hyphens')) {
      return true;
    }
    return false;
  });
  return unwrapWherePseudo(oklchToRgbCss(unwrappedLayers));
}

function sadaTailwindLegacyCompatPlugin(): Plugin {
  return {
    name: 'sada-tailwind-legacy-compat',
    enforce: 'post',
    transform(code, id) {
      if (id.split('?')[0].endsWith('.css') && code.includes('@layer')) {
        return {
          code: transformCssForLegacyMobile(code),
          map: null,
        };
      }
      return null;
    },
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const asset = bundle[fileName];
        if (
          fileName.endsWith('.css') &&
          asset.type === 'asset' &&
          typeof asset.source === 'string'
        ) {
          asset.source = transformCssForLegacyMobile(asset.source);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      sadaTailwindLegacyCompatPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          '_redirects',
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'صَدَى - SADA',
          short_name: 'صَدَى SADA',
          description: 'منصة صَدَى الملكية للدردشة الصوتية المباشرة والمسابقات العربية.',
          theme_color: '#070913',
          background_color: '#070913',
          display: 'standalone',
          dir: 'rtl',
          lang: 'ar',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: ['es2015', 'chrome64', 'safari12'],
      cssTarget: ['chrome64', 'safari12'],
      sourcemap: false,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

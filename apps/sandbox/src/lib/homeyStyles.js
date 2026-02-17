/**
 * Injects Homey CSS variables and classes into an iframe document.
 * Mirrors the real Homey widget runtime styling environment.
 */
export function injectHomeyStyles(doc) {
    if (!doc) return;

    let style = doc.getElementById('homey-mock-styles');
    if (!style) {
        style = doc.createElement('style');
        style.id = 'homey-mock-styles';
        doc.head.appendChild(style);
    }

    style.textContent = `
    :root {
      /* Colors */
      --homey-color-mono-000: #000;
      --homey-color-mono-900: #1a1a1a;
      --homey-color-mono-800: #333;
      --homey-color-mono-700: #4d4d4d;
      --homey-color-mono-600: #666;
      --homey-color-mono-500: #808080;
      --homey-color-mono-400: #999;
      --homey-color-mono-300: #b3b3b3;
      --homey-color-mono-200: #ccc;
      --homey-color-mono-100: #e6e6e6;
      --homey-color-mono-050: #f2f2f2;
      --homey-color-mono-000: #fff;

      /* Font Sizes */
      --homey-font-size-xxlarge: 32px;
      --homey-font-size-xlarge: 24px;
      --homey-font-size-large: 20px;
      --homey-font-size-default: 17px;
      --homey-font-size-small: 14px;

      /* Line Heights */
      --homey-line-height-xxlarge: 40px;
      --homey-line-height-xlarge: 32px;
      --homey-line-height-large: 28px;
      --homey-line-height-default: 24px;
      --homey-line-height-small: 20px;

      /* Font Weights */
      --homey-font-weight-bold: 700;
      --homey-font-weight-medium: 500;
      --homey-font-weight-regular: 400;

      /* Spacing */
      --homey-su: 4px;
      --homey-su-2: 8px;
      --homey-su-4: 16px;

      /* Blue */
      --homey-color-blue-50: #e5f5ff;
      --homey-color-blue-100: #b3e0ff;
      --homey-color-blue-200: #80ccff;
      --homey-color-blue-300: #4db8ff;
      --homey-color-blue-400: #1a9eff;
      --homey-color-blue-500: #0099ff;
      --homey-color-blue-600: #0080d9;
      --homey-color-blue-700: #0066ad;

      /* Green */
      --homey-color-green-50: #e8f9f0;
      --homey-color-green-100: #c1edd8;
      --homey-color-green-200: #9ae2c0;
      --homey-color-green-300: #74d6a8;
      --homey-color-green-400: #4dcb90;
      --homey-color-green-500: #26c281;
      --homey-color-green-600: #20a36c;
      --homey-color-green-700: #1a8357;

      /* Orange */
      --homey-color-orange-50: #fff5e5;
      --homey-color-orange-100: #ffe4b3;
      --homey-color-orange-200: #ffd280;
      --homey-color-orange-300: #ffc14d;
      --homey-color-orange-400: #ffaf1a;
      --homey-color-orange-500: #ff9500;
      --homey-color-orange-600: #d97f00;
      --homey-color-orange-700: #b36800;

      /* Red */
      --homey-color-red-50: #ffeceb;
      --homey-color-red-100: #ffc8c7;
      --homey-color-red-200: #ffa5a3;
      --homey-color-red-300: #ff817f;
      --homey-color-red-400: #ff5e5b;
      --homey-color-red-500: #ff3b30;
      --homey-color-red-600: #d93229;
      --homey-color-red-700: #b32922;

      /* Borders & Lines */
      --homey-line-color: rgba(0, 0, 0, 0.1);
      --homey-line-color-light: rgba(0, 0, 0, 0.05);

      --homey-line: 1px solid var(--homey-line-color);
      --homey-line-light: 1px solid var(--homey-line-color-light);

      --homey-border-radius-default: 12px;
      --homey-border-radius-small: 8px;

      /* Theme dependent */
      --homey-text-color: #333;
      --homey-background-color: #fff;
      --homey-bg-color: var(--homey-background-color);
    }

    /* Dark Mode Overrides */
    .homey-theme-dark {
      --homey-text-color: #fff;
      --homey-background-color: #2c2c2c;

      --homey-line-color: rgba(255, 255, 255, 0.1);
      --homey-line-color-light: rgba(255, 255, 255, 0.05);
    }

    /* Light Mode Overrides */
    .homey-theme-light {
      --homey-text-color: #333;
      --homey-background-color: #fff;

      --homey-line-color: rgba(0, 0, 0, 0.1);
      --homey-line-color-light: rgba(0, 0, 0, 0.05);
    }

    body {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--homey-text-color);
      margin: 0;
    }

    /* Homey Widget Classes */
    body.homey-widget {
      padding: 0;
      box-sizing: border-box;
    }
    body.homey-widget-small {
      padding: var(--homey-su-2);
      box-sizing: border-box;
    }
    body.homey-widget-full {
      padding: 0;
    }
  `;
}

/**
 * Applies the given theme to an iframe document.
 * Sets body classes and injects Homey CSS variables.
 */
export function setIframeTheme(doc, theme) {
    if (!doc || !doc.body) return;

    doc.body.classList.remove('homey-theme-light', 'homey-theme-dark');
    doc.body.classList.add(`homey-theme-${theme}`);
    doc.body.dataset.theme = theme;

    // Ensure homey-widget class is present by default
    if (!doc.body.classList.contains('homey-widget') &&
        !doc.body.classList.contains('homey-widget-small') &&
        !doc.body.classList.contains('homey-widget-full')) {
        doc.body.classList.add('homey-widget');
    }

    injectHomeyStyles(doc);
}

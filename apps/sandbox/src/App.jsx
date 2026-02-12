import { useState, useEffect, useRef } from 'react';
import registry from './registry.json';
import MockHomey from './lib/MockHomey';
import './index.css';

// Icons
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"></path>
    <path d="M1 20v-6h6"></path>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const CubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
)

function App() {
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [mockHomeyInstance, setMockHomeyInstance] = useState(null);
  const iframeRef = useRef(null);
  const [widgetHeight, setWidgetHeight] = useState(160);
  const [previewWidth, setPreviewWidth] = useState(480); // Default to Medium
  const [settingsValues, setSettingsValues] = useState({});
  const [key, setKey] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('sandbox-theme') || 'dark');

  // Group widgets by App for the sidebar
  const groupedWidgets = registry.reduce((acc, widget) => {
    if (!acc[widget.app]) acc[widget.app] = [];
    acc[widget.app].push(widget);
    return acc;
  }, {});

  useEffect(() => {
    // Select first widget by default
    if (registry.length > 0 && !selectedWidget) {
      selectWidget(registry[0]);
    }
  }, []);

  // Theme effect
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('sandbox-theme', theme);

    // Also try to update iframe body class if it exists
    if (iframeRef.current && iframeRef.current.contentDocument) {
      setIframeTheme(iframeRef.current.contentDocument, theme);
    }
  }, [theme]);

  // Homey CSS Variables and Classes
  const injectHomeyStyles = (doc) => {
    if (!doc) return;

    // Create or update style element
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
        
        /* Semantic Colors - Extended Palette */
        /* Blue */
        --homey-color-blue-50: #e5f5ff;
        --homey-color-blue-100: #b3e0ff;
        --homey-color-blue-200: #80ccff;
        --homey-color-blue-300: #4db8ff;
        --homey-color-blue-400: #1a9eff; /* or close to 500 */
        --homey-color-blue-500: #0099ff; /* Primary */
        --homey-color-blue-600: #0080d9;
        --homey-color-blue-700: #0066ad;

        /* Green */
        --homey-color-green-50: #e8f9f0;
        --homey-color-green-100: #c1edd8;
        --homey-color-green-200: #9ae2c0;
        --homey-color-green-300: #74d6a8;
        --homey-color-green-400: #4dcb90;
        --homey-color-green-500: #26c281; /* Primary */
        --homey-color-green-600: #20a36c;
        --homey-color-green-700: #1a8357;

        /* Orange */
        --homey-color-orange-50: #fff5e5;
        --homey-color-orange-100: #ffe4b3;
        --homey-color-orange-200: #ffd280;
        --homey-color-orange-300: #ffc14d;
        --homey-color-orange-400: #ffaf1a;
        --homey-color-orange-500: #ff9500; /* Primary */
        --homey-color-orange-600: #d97f00;
        --homey-color-orange-700: #b36800;

        /* Red */
        --homey-color-red-50: #ffeceb;
        --homey-color-red-100: #ffc8c7;
        --homey-color-red-200: #ffa5a3;
        --homey-color-red-300: #ff817f;
        --homey-color-red-400: #ff5e5b;
        --homey-color-red-500: #ff3b30; /* Primary */
        --homey-color-red-600: #d93229;
        --homey-color-red-700: #b32922;

        /* Borders & Lines */
        --homey-line-color: rgba(0, 0, 0, 0.1);
        --homey-line-color-light: rgba(0, 0, 0, 0.05);

        --homey-line: 1px solid var(--homey-line-color);
        --homey-line-light: 1px solid var(--homey-line-color-light);

        --homey-border-radius-default: 12px;
        --homey-border-radius-small: 8px;

        /* Theme dependent (Set defaults, overridden by class) */
        --homey-text-color: #333;
        --homey-background-color: #fff;
        --homey-bg-color: var(--homey-background-color); /* Alias */
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

  const setIframeTheme = (doc, t) => {
    if (!doc || !doc.body) return;
    doc.body.classList.remove('homey-theme-light', 'homey-theme-dark');
    doc.body.classList.add(`homey-theme-${t}`);
    doc.body.dataset.theme = t;

    // Also ensure homey-widget class is present by default if no other widget class is there?
    // Docs say "we added .homey-widget class to the body by default".
    if (!doc.body.classList.contains('homey-widget') &&
      !doc.body.classList.contains('homey-widget-small') &&
      !doc.body.classList.contains('homey-widget-full')) {
      doc.body.classList.add('homey-widget');
    }

    injectHomeyStyles(doc);
  }

  const selectWidget = (widget) => {
    setSelectedWidget(widget);
    const defaults = {};
    widget.settings.forEach(s => {
      defaults[s.id] = s.value;
    });
    setSettingsValues(defaults);
    setKey(prev => prev + 1);

    // Set initial height from manifest or default
    setWidgetHeight(widget.height || 160);
  };

  const reloadWidget = () => {
    setKey(prev => prev + 1);
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }

  const handleIframeLoad = () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;

    const win = iframeRef.current.contentWindow;
    const doc = win.document;

    // Apply theme immediately
    setIframeTheme(doc, theme);

    const mock = new MockHomey({
      onHeightChange: (h) => {
        console.log('App: Widget requested height', h);
        setWidgetHeight(h);
      }
    });
    mock.settings = { ...settingsValues };
    setMockHomeyInstance(mock);
    win.Homey = mock;

    if (typeof win.onHomeyReady === 'function') {
      try {
        console.log('Triggering onHomeyReady...');
        win.onHomeyReady(mock);
      } catch (err) {
        console.error('Error calling onHomeyReady:', err);
      }
    }
  };

  const updateSetting = (id, value) => {
    console.log('App: updateSetting', id, value);
    const newSettings = { ...settingsValues, [id]: value };
    setSettingsValues(newSettings);
    if (mockHomeyInstance) {
      mockHomeyInstance.updateSettings({ ...newSettings });
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <CubeIcon />
          <span>WidgetSandbox</span>
        </div>
        <div className="widget-list">
          {Object.entries(groupedWidgets).map(([appId, widgets]) => (
            <div key={appId} style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase'
              }}>
                {appId.split('.').pop().replace('widgetbox-', '')}
              </div>
              {widgets.map(w => (
                <div
                  key={w.id}
                  className={`widget-item ${selectedWidget?.id === w.id ? 'active' : ''}`}
                  onClick={() => selectWidget(w)}
                >
                  <span className="widget-name">{w.name?.en || w.id}</span>
                  <span className="widget-app">{w.id}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Preview Area */}
      <div className="preview-area">
        <div className="preview-toolbar">
          <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
            {/* Left side actions if needed */}
            <span className="status-pill">{theme.toUpperCase()}</span>
          </div>

          <div style={{ fontWeight: 700 }}>{selectedWidget?.name?.en || 'Select Widget'}</div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <div className="width-switcher" style={{ display: 'flex', gap: '2px', marginRight: '1rem' }}>
              <button
                className={`toolbar-btn ${previewWidth === 360 ? 'active' : ''}`}
                onClick={() => setPreviewWidth(360)}
                title="Small (360px)"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: previewWidth === 360 ? 'bold' : 'normal', background: previewWidth === 360 ? 'var(--homey-color-blue-500)' : '', color: previewWidth === 360 ? 'white' : '' }}
              >S</button>
              <button
                className={`toolbar-btn ${previewWidth === 480 ? 'active' : ''}`}
                onClick={() => setPreviewWidth(480)}
                title="Medium (480px)"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: previewWidth === 480 ? 'bold' : 'normal', background: previewWidth === 480 ? 'var(--homey-color-blue-500)' : '', color: previewWidth === 480 ? 'white' : '' }}
              >M</button>
              <button
                className={`toolbar-btn ${previewWidth === 720 ? 'active' : ''}`}
                onClick={() => setPreviewWidth(720)}
                title="Large (720px)"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: previewWidth === 720 ? 'bold' : 'normal', background: previewWidth === 720 ? 'var(--homey-color-blue-500)' : '', color: previewWidth === 720 ? 'white' : '' }}
              >L</button>
            </div>
            <button onClick={toggleTheme} title="Toggle Theme" className="toolbar-btn">
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button onClick={reloadWidget} title="Reload Widget" className="toolbar-btn">
              <RefreshIcon />
            </button>
          </div>
        </div>

        <div className="preview-content">
          {selectedWidget ? (
            <div className="device-frame" style={{
              width: `${previewWidth}px`, /* Fixed width simulating dashboard column */
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 'none',
              transition: 'width 0.3s ease',
              padding: 0
            }}>
              <div
                className={selectedWidget?.isTransparent ? '' : 'homey-card'}
                style={{
                  width: '100%',
                  ...(typeof widgetHeight === 'string' && widgetHeight.endsWith('%')
                    ? {
                      aspectRatio: `${100 / parseFloat(widgetHeight)}`,
                      height: 'auto'
                    }
                    : {
                      height: `${widgetHeight}px`,
                      // If it's fixed height, we don't set aspect-ratio
                    }
                  ),
                  transition: 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  position: 'relative'
                }}
              >
                <iframe
                  key={key}
                  ref={iframeRef}
                  src={selectedWidget.path}
                  onLoad={handleIframeLoad}
                  title="Widget Sandbox"
                  style={{
                    height: '100%',
                    width: '100%',
                    display: 'block',
                    border: 'none',
                    overflow: 'hidden'
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a widget to preview</div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <div className="settings-panel">
        <div className="sidebar-header">
          <SettingsIcon />
          <span>Configuration</span>
        </div>

        <div className="settings-content">
          {selectedWidget?.settings.length > 0 ? (
            selectedWidget.settings.map(setting => (
              <div key={setting.id} className="setting-group">

                {setting.type === 'checkbox' ? (
                  <div className="checkbox-row" onClick={() => updateSetting(setting.id, !settingsValues[setting.id])}>
                    <label className="setting-label" style={{ marginBottom: 0 }}>
                      {setting.label?.en || setting.id}
                    </label>
                    <input
                      type="checkbox"
                      checked={!!settingsValues[setting.id]}
                      onChange={(e) => updateSetting(setting.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <>
                    <label className="setting-label">{setting.label?.en || setting.id}</label>

                    {setting.type === 'text' && (
                      <input
                        type="text"
                        value={settingsValues[setting.id] || ''}
                        onChange={(e) => updateSetting(setting.id, e.target.value)}
                        placeholder={setting.hint?.en}
                      />
                    )}
                    {setting.type === 'number' && (
                      <input
                        type="number"
                        value={settingsValues[setting.id] || ''}
                        onChange={(e) => updateSetting(setting.id, Number(e.target.value))}
                        min={setting.min}
                        max={setting.max}
                        step={setting.step}
                      />
                    )}
                    {setting.type === 'dropdown' && (
                      <select
                        value={settingsValues[setting.id] || ''}
                        onChange={(e) => updateSetting(setting.id, e.target.value)}
                      >
                        {setting.values?.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label?.en || opt.id}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                {/* Hint text */}
                {setting.hint?.en && setting.type !== 'text' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {setting.hint.en}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">No settings available</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

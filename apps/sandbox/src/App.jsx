import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import WidgetPreview from "./components/WidgetPreview";
import { setIframeTheme } from "./lib/homeyStyles";
import MockHomey from "./lib/MockHomey";
import { DEFAULT_SCENARIO } from "./lib/scenarios";
import registry from "./registry.json";
import "./index.css";

function App() {
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [mockHomeyInstance, setMockHomeyInstance] = useState(null);
  const iframeRef = useRef(null);
  const [widgetHeight, setWidgetHeight] = useState(160);
  const [previewWidth, setPreviewWidth] = useState(480);
  const [settingsValues, setSettingsValues] = useState({});
  // Latest values for async callbacks (iframe load awaits the locale fetch).
  const settingsRef = useRef(settingsValues);
  settingsRef.current = settingsValues;
  const mockRef = useRef(null);
  const [key, setKey] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem("sandbox-theme") || "dark");
  const [activeScenario, setActiveScenario] = useState(DEFAULT_SCENARIO);

  // Group widgets by app for sidebar
  const groupedWidgets = useMemo(
    () =>
      registry.reduce((acc, widget) => {
        if (!acc[widget.app]) acc[widget.app] = [];
        acc[widget.app].push(widget);
        return acc;
      }, {}),
    [],
  );

  // Update mock instance when scenario changes
  useEffect(() => {
    if (mockHomeyInstance?.setScenario) {
      mockHomeyInstance.setScenario(activeScenario);
    }
  }, [activeScenario, mockHomeyInstance]);

  const selectWidget = useCallback((widget) => {
    setSelectedWidget(widget);
    const defaults = {};
    widget.settings.forEach((s) => {
      defaults[s.id] = s.value;
    });
    setSettingsValues(defaults);
    setKey((prev) => prev + 1);
    setWidgetHeight(widget.height || 160);
    setActiveScenario(DEFAULT_SCENARIO);
  }, []);

  // Handle URL routing (once, on mount)
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial selection must only run on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const widgetId = params.get("widget");

    if (widgetId) {
      const widget = registry.find((w) => w.id === widgetId);
      if (widget) {
        selectWidget(widget);
        return;
      }
    }

    // Default to first widget if no valid ID in URL
    if (registry.length > 0 && !selectedWidget) {
      selectWidget(registry[0]);
    }
  }, []);

  // Update URL when widget changes
  useEffect(() => {
    if (selectedWidget) {
      const url = new URL(window.location);
      url.searchParams.set("widget", selectedWidget.id);
      window.history.pushState({}, "", url);
    }
  }, [selectedWidget]);

  // Theme effect
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("sandbox-theme", theme);

    if (iframeRef.current?.contentDocument) {
      setIframeTheme(iframeRef.current.contentDocument, theme);
    }
  }, [theme]);

  const reloadWidget = useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const handleIframeLoad = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;

    const win = iframeRef.current.contentWindow;
    const doc = win.document;

    setIframeTheme(doc, theme);

    // Fetch locale data
    let localeData = null;
    if (selectedWidget.locales?.en) {
      try {
        const res = await fetch(selectedWidget.locales.en);
        localeData = await res.json();
      } catch (err) {
        console.error("[App] Failed to load locale", err);
      }
    }

    const mock = new MockHomey({
      onHeightChange: (h) => setWidgetHeight(h),
      widgetId: selectedWidget.id,
    });

    if (localeData) {
      mock.setLocaleData(localeData);
    }

    mock.settings = { ...settingsRef.current };
    mockRef.current = mock;
    setMockHomeyInstance(mock);

    if (mock.setScenario) {
      mock.setScenario(activeScenario);
    }

    win.Homey = mock;

    // Inject iOS simulation flag for debug scenarios
    win.__SIMULATE_IOS__ = activeScenario === "ios";

    if (typeof win.onHomeyReady === "function") {
      try {
        win.onHomeyReady(mock);
      } catch (err) {
        console.error("Error calling onHomeyReady:", err);
      }
    }
  }, [theme, selectedWidget, activeScenario]);

  const updateSetting = useCallback((id, value) => {
    const newSettings = { ...settingsRef.current, [id]: value };
    settingsRef.current = newSettings;
    setSettingsValues(newSettings);
    mockRef.current?.updateSettings({ ...newSettings });
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        groupedWidgets={groupedWidgets}
        selectedWidget={selectedWidget}
        onSelectWidget={selectWidget}
      />

      <div className="preview-area">
        <Toolbar
          theme={theme}
          onToggleTheme={toggleTheme}
          onReload={reloadWidget}
          previewWidth={previewWidth}
          onSetPreviewWidth={setPreviewWidth}
          widgetName={selectedWidget?.name?.en}
        />
        <WidgetPreview
          ref={iframeRef}
          selectedWidget={selectedWidget}
          widgetHeight={widgetHeight}
          previewWidth={previewWidth}
          iframeKey={key}
          onIframeLoad={handleIframeLoad}
        />
      </div>

      <SettingsPanel
        selectedWidget={selectedWidget}
        settingsValues={settingsValues}
        onUpdateSetting={updateSetting}
        activeScenario={activeScenario}
        onSetScenario={setActiveScenario}
        onReload={reloadWidget}
      />
    </div>
  );
}

export default App;

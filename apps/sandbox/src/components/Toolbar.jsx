import { RefreshIcon, MoonIcon, SunIcon } from './Icons';

const WIDTH_PRESETS = [
    { width: 360, label: 'S', title: 'Small (360px)' },
    { width: 480, label: 'M', title: 'Medium (480px)' },
    { width: 720, label: 'L', title: 'Large (720px)' },
];

export default function Toolbar({
    theme,
    onToggleTheme,
    onReload,
    previewWidth,
    onSetPreviewWidth,
    widgetName,
}) {
    return (
        <div className="preview-toolbar">
            <div className="toolbar-left">
                <span className="status-pill">{theme.toUpperCase()}</span>
            </div>

            <div className="toolbar-title">{widgetName || 'Select Widget'}</div>

            <div className="toolbar-right">
                <div className="width-switcher">
                    {WIDTH_PRESETS.map(({ width, label, title }) => (
                        <button
                            key={width}
                            className={`toolbar-btn width-btn ${previewWidth === width ? 'active' : ''}`}
                            onClick={() => onSetPreviewWidth(width)}
                            title={title}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button onClick={onToggleTheme} title="Toggle Theme" className="toolbar-btn">
                    {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                </button>
                <button onClick={onReload} title="Reload Widget" className="toolbar-btn">
                    <RefreshIcon />
                </button>
            </div>
        </div>
    );
}

import { SettingsIcon, BugIcon } from './Icons';
import { SCENARIOS } from '../lib/scenarios';

export default function SettingsPanel({
    selectedWidget,
    settingsValues,
    onUpdateSetting,
    activeScenario,
    onSetScenario,
    onReload,
}) {
    const hasScenarios = selectedWidget && SCENARIOS[selectedWidget.id];

    return (
        <div className="settings-panel">
            <div className="sidebar-header">
                <SettingsIcon />
                <span>Configuration</span>
            </div>

            <div className="settings-content">
                {/* Debug Scenarios */}
                {hasScenarios && (
                    <div className="setting-group debug-section">
                        <div className="debug-header">
                            <BugIcon />
                            <span>Debug Scenarios</span>
                        </div>

                        <div className="setting-row">
                            <select
                                value={activeScenario}
                                onChange={(e) => {
                                    onSetScenario(e.target.value);
                                    setTimeout(onReload, 100);
                                }}
                            >
                                {(() => {
                                    const scenarios = SCENARIOS[selectedWidget.id];
                                    const entries = Object.entries(scenarios);
                                    const hasGroups = entries.some(([, def]) => def.group);
                                    if (!hasGroups) {
                                        return entries.map(([key, def]) => (
                                            <option key={key} value={key}>{def.label}</option>
                                        ));
                                    }
                                    const groups = {};
                                    const ungrouped = [];
                                    entries.forEach(([key, def]) => {
                                        if (def.group) {
                                            if (!groups[def.group]) groups[def.group] = [];
                                            groups[def.group].push([key, def]);
                                        } else {
                                            ungrouped.push([key, def]);
                                        }
                                    });
                                    return (
                                        <>
                                            {ungrouped.map(([key, def]) => (
                                                <option key={key} value={key}>{def.label}</option>
                                            ))}
                                            {Object.entries(groups).map(([group, items]) => (
                                                <optgroup key={group} label={group}>
                                                    {items.map(([key, def]) => (
                                                        <option key={key} value={key}>{def.label}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </>
                                    );
                                })()}
                            </select>
                        </div>

                        {SCENARIOS[selectedWidget.id][activeScenario]?.type === 'real' && (
                            <div className="setting-hint warning">
                                Warning: Fetching real data may fail due to browser CORS restrictions.
                            </div>
                        )}
                    </div>
                )}

                {/* Widget Settings */}
                {selectedWidget?.settings.length > 0 ? (
                    selectedWidget.settings.map(setting => (
                        <div key={setting.id} className="setting-group">
                            {setting.type === 'checkbox' ? (
                                <div className="checkbox-row" onClick={() => onUpdateSetting(setting.id, !settingsValues[setting.id])}>
                                    <label className="setting-label" style={{ marginBottom: 0 }}>
                                        {setting.label?.en || setting.id}
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={!!settingsValues[setting.id]}
                                        onChange={(e) => onUpdateSetting(setting.id, e.target.checked)}
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
                                            onChange={(e) => onUpdateSetting(setting.id, e.target.value)}
                                            placeholder={setting.hint?.en}
                                        />
                                    )}
                                    {setting.type === 'number' && (
                                        <input
                                            type="number"
                                            value={settingsValues[setting.id] || ''}
                                            onChange={(e) => onUpdateSetting(setting.id, Number(e.target.value))}
                                            min={setting.min}
                                            max={setting.max}
                                            step={setting.step}
                                        />
                                    )}
                                    {setting.type === 'dropdown' && (
                                        <select
                                            value={settingsValues[setting.id] || ''}
                                            onChange={(e) => onUpdateSetting(setting.id, e.target.value)}
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
                                <div className="setting-hint">{setting.hint.en}</div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="empty-state">No settings available</div>
                )}
            </div>
        </div>
    );
}

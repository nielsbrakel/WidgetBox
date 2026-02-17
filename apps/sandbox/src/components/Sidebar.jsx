import { CubeIcon } from './Icons';

export default function Sidebar({ groupedWidgets, selectedWidget, onSelectWidget }) {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <CubeIcon />
                <span>WidgetSandbox</span>
            </div>
            <div className="widget-list">
                {Object.entries(groupedWidgets).map(([appId, widgets]) => (
                    <div key={appId} className="widget-group">
                        <div className="widget-group-label">
                            {appId.split('.').pop().replace('widgetbox-', '')}
                        </div>
                        {widgets.map(w => (
                            <div
                                key={w.id}
                                className={`widget-item ${selectedWidget?.id === w.id ? 'active' : ''}`}
                                onClick={() => onSelectWidget(w)}
                            >
                                <span className="widget-name">{w.name?.en || w.id}</span>
                                <span className="widget-app">{w.id}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

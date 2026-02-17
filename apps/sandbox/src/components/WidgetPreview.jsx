import { forwardRef } from 'react';

const WidgetPreview = forwardRef(function WidgetPreview({
    selectedWidget,
    widgetHeight,
    previewWidth,
    iframeKey,
    onIframeLoad,
}, ref) {
    if (!selectedWidget) {
        return (
            <div className="preview-content">
                <div className="empty-state">Select a widget to preview</div>
            </div>
        );
    }

    const isPercentageHeight = typeof widgetHeight === 'string' && widgetHeight.endsWith('%');

    return (
        <div className="preview-content">
            <div
                className="device-frame"
                style={{
                    width: `${previewWidth}px`,
                    maxWidth: '100%',
                }}
            >
                <div
                    className={selectedWidget.isTransparent ? '' : 'homey-card'}
                    style={{
                        width: '100%',
                        ...(isPercentageHeight
                            ? {
                                aspectRatio: `${100 / parseFloat(widgetHeight)}`,
                                height: 'auto',
                            }
                            : {
                                height: `${widgetHeight}px`,
                            }),
                        position: 'relative',
                    }}
                >
                    <iframe
                        key={iframeKey}
                        ref={ref}
                        src={selectedWidget.path}
                        onLoad={onIframeLoad}
                        title="Widget Sandbox"
                        className="widget-iframe"
                    />
                </div>
            </div>
        </div>
    );
});

export default WidgetPreview;

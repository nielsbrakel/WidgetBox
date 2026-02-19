export const SCENARIOS = {
    'buienradar-graph': {
        'default': { label: 'Dynamic Rain (Default)', type: 'mock' },
        'real': { label: 'Real Data (Live)', type: 'real' },
        'no-rain': { label: 'No Rain', type: 'mock' },
        'light-rain': { label: 'Light Rain', type: 'mock' },
        'heavy-rain': { label: 'Heavy Rain', type: 'mock' },
        'error': { label: 'API Error', type: 'error' }
    },
    'buienradar-station': {
        'default': { label: 'Station Data (Default)', type: 'mock' },
        'real': { label: 'Real Data (Live)', type: 'real' },
        'error': { label: 'API Error', type: 'error' }
    },
    'buienradar-forecast': {
        'default': { label: 'Forecast (Default)', type: 'mock' },
        'real': { label: 'Real Data (Live)', type: 'real' },
        'error': { label: 'API Error', type: 'error' }
    },
    'aquarium': {
        'default':              { label: 'Fresh Start',                type: 'mock', group: 'Progression' },
        'tier-2-ready':         { label: 'Tropical Ready',             type: 'mock', group: 'Progression' },
        'tier-2-active':        { label: 'Tropical Active',            type: 'mock', group: 'Progression' },
        'tier-3-endgame':       { label: 'Saltwater Endgame',          type: 'mock', group: 'Progression' },
        'neglected-48h':        { label: 'Neglected 48h',              type: 'mock', group: 'Problem States' },
        'low-food':             { label: 'Low Food',                   type: 'mock', group: 'Problem States' },
        'dirty-near-threshold': { label: 'Dirty Tank (25%)',           type: 'mock', group: 'Problem States' },
        'dirty-big-tank':       { label: 'Dirty Saltwater (15%)',      type: 'mock', group: 'Problem States' },
        'rich':                 { label: 'Rich (10k coins)',           type: 'mock', group: 'Test Scenarios' },
        'tank-full':            { label: 'Fresh Full (8/8)',           type: 'mock', group: 'Test Scenarios' },
        'tier-3-crowded':       { label: 'Saltwater Crowded (18/20)',  type: 'mock', group: 'Test Scenarios' },
        'multi-tank-decorated': { label: 'Multi-Tank Decorated',       type: 'mock', group: 'Test Scenarios' },
        'empty-tank':           { label: 'Empty Tank (0 fish)',        type: 'mock', group: 'New Features' },
        'movement-showcase':    { label: 'Movement Types Showcase',    type: 'mock', group: 'New Features' },
        'schooling-showcase':   { label: 'Schooling Fish (10 tetras)', type: 'mock', group: 'New Features' },
        'floating-decor':       { label: 'Floating Plants & Decor',    type: 'mock', group: 'New Features' },
    }
};

export const DEFAULT_SCENARIO = 'default';

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
        'default':              { label: 'Fresh Start (Cold Water)',    type: 'mock', group: 'Progression' },
        'tier-2-ready':         { label: 'Tropical Ready',             type: 'mock', group: 'Progression' },
        'tier-2-active':        { label: 'Tropical Active',            type: 'mock', group: 'Progression' },
        'tier-3-endgame':       { label: 'Sea Water Endgame',          type: 'mock', group: 'Progression' },
        'neglected-48h':        { label: 'Neglected 48h',              type: 'mock', group: 'Problem States' },
        'low-food':             { label: 'Low Food',                   type: 'mock', group: 'Problem States' },
        'dirty-near-threshold': { label: 'Dirty Tank (22%)',           type: 'mock', group: 'Problem States' },
        'dirty-big-tank':       { label: 'Dirty Sea Water (25%)',      type: 'mock', group: 'Problem States' },
        'rich':                 { label: 'Rich (10k coins)',           type: 'mock', group: 'Test Scenarios' },
        'tank-full':            { label: 'Cold Water Full (6/6)',      type: 'mock', group: 'Test Scenarios' },
        'tier-3-crowded':       { label: 'Sea Water Crowded (18/20)',  type: 'mock', group: 'Test Scenarios' },
        'multi-tank-decorated': { label: 'Multi-Tank Decorated',       type: 'mock', group: 'Test Scenarios' },
    }
};

export const DEFAULT_SCENARIO = 'default';

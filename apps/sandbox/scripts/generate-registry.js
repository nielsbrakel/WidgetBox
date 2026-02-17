import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This resolves to the 'apps' directory in the monorepo
const APPS_DIR = path.resolve(__dirname, '../../');
const OUTPUT_FILE = path.resolve(__dirname, '../src/registry.json'); // src/registry.json

async function generateRegistry() {
    console.log('Scanning for widgets...');

    // Find all widget.compose.json files in apps/*/widgets/*/
    const widgetFiles = await glob('**/widgets/*/widget.compose.json', {
        cwd: APPS_DIR,
        ignore: ['**/node_modules/**', '**/sandbox/**']
    });

    const widgets = widgetFiles.map(file => {
        const fullPath = path.join(APPS_DIR, file);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

        // file: com.nielsvanbrakel.widgetbox-clocks/widgets/digital-clock/widget.compose.json
        const parts = file.split(path.sep);
        const appName = parts[0];
        const widgetId = parts[2];

        // Build absolute path to index.html
        const widgetDir = path.dirname(fullPath);
        const indexHtmlPath = path.join(widgetDir, 'public', 'index.html');

        // Create Vite /@fs/ URL
        // Ensure we don't have double slashes if indexHtmlPath starts with /
        const urlPath = `/@fs${indexHtmlPath}`;

        console.log(`Found widget: ${widgetId} (${appName}) -> ${urlPath}`);

        const appDir = path.dirname(path.dirname(widgetDir)); // apps/<app-name>
        const localesDir = path.join(appDir, 'locales');

        // Find available locales
        const locales = {};
        if (fs.existsSync(localesDir)) {
            const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
            localeFiles.forEach(f => {
                const lang = path.basename(f, '.json');
                const localePath = path.join(localesDir, f);
                // Create Vite /@fs/ URL for the locale file
                locales[lang] = `/@fs${localePath}`;
            });
        }

        return {
            id: widgetId,
            app: appName,
            name: content.name,
            settings: content.settings || [],
            isTransparent: !!(content.isTransparent || content.transparent),
            height: content.platforms?.web?.height || content.height || 160,
            width: content.platforms?.web?.width || content.width,
            path: urlPath,
            absolutePath: widgetDir,
            locales: locales
        };
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(widgets, null, 2));
    console.log(`Registry generated with ${widgets.length} widgets at ${OUTPUT_FILE}`);
}

generateRegistry().catch(console.error);

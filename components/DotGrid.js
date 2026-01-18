"use client";

import dynamic from 'next/dynamic';
import { useBackground } from './Background'; // Assuming Background provider will store the version
// Or just passing it as a prop.
// The user asked for it to be in "bg settings option".
// We will look at how to get that preference.
// For now, let's make this component accept a `version` prop or use context.

import DotGridWebGL from './DotGridWebGL';
import DotGridCanvas from './DotGridCanvas';
import DotGridSimple from './DotGridSimple';

// Registry Exports (re-export for consumers)
export { registerTilePosition, unregisterTilePosition, getTilePosition, triggerDotRipple } from './DotGridRegistry';

export default function DotGrid({ className = '', zoomLevel = 0 }) {
    // We need to access the preference.
    // Ideally useBackground() context provided the detailed settings.
    // If usage in Background.js passes it down, we are good.
    // If not, we might need to modify Background context to support sub-options.

    // Let's assume useBackground gives us access to this setting, or we read it here.
    const { dotGridVersion = 'v3' } = useBackground();

    // Render based on version
    switch (dotGridVersion) {
        case 'v1': // "Original" / Simple
            return <DotGridSimple className={className} zoomLevel={zoomLevel} />;
        case 'v2': // "Fluid" (Canvas)
            return <DotGridCanvas className={className} zoomLevel={zoomLevel} />;
        case 'v3': // "GPU" (WebGL) - DEFAULT
        default:
            return <DotGridWebGL className={className} zoomLevel={zoomLevel} />;
    }
}

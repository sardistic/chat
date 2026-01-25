"use client";

import { useState, useEffect, createContext, useContext, memo } from 'react';
import DotGrid from './DotGrid';
import ParticlesBackground from './ParticlesBackground';
import StarMapBackground from './StarMapBackground';

// Background types
export const BACKGROUND_TYPES = {
    STARMAP: 'starmap',
    STARGRID: 'stargrid',
    GRID: 'grid',
    STATIC: 'static',
};

// Context for background preference
const BackgroundContext = createContext({
    backgroundType: BACKGROUND_TYPES.STARMAP,
    setBackgroundType: () => { },
    dotGridVersion: 'v3',
    setDotGridVersion: () => { },
    performanceMode: false,
    setPerformanceMode: () => { }
});

export function useBackground() {
    return useContext(BackgroundContext);
}

// Provider component
export function BackgroundProvider({ children }) {
    const [backgroundType, setBackgroundType] = useState(BACKGROUND_TYPES.GRID);
    const [dotGridVersion, setDotGridVersion] = useState('v3');
    const [performanceMode, setPerformanceMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('backgroundPreference');
        if (saved && Object.values(BACKGROUND_TYPES).includes(saved)) {
            setBackgroundType(saved);
        }
        const savedVersion = localStorage.getItem('dotGridVersion');
        if (savedVersion) setDotGridVersion(savedVersion);

        const savedPerf = localStorage.getItem('performanceMode');
        if (savedPerf === 'true') {
            setPerformanceMode(true);
            // Force static if perf mode was saved as on
            setBackgroundType(BACKGROUND_TYPES.STATIC);
        }

        setMounted(true);
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        if (mounted) {
            localStorage.setItem('backgroundPreference', backgroundType);
            localStorage.setItem('dotGridVersion', dotGridVersion);
            localStorage.setItem('performanceMode', performanceMode);
        }
    }, [backgroundType, dotGridVersion, performanceMode, mounted]);

    // Enforce static background when perf mode is enabled
    const handleSetPerformanceMode = (enabled) => {
        setPerformanceMode(enabled);
        if (enabled) {
            setBackgroundType(BACKGROUND_TYPES.STATIC);
        } else {
            // Optional: Restore previous? For now just stay static until user changes it.
            // Or default back to STARMAP for a "wow" re-enable?
            // Let's leave it manual to avoid jarring shifts.
        }
    };

    return (
        <BackgroundContext.Provider value={{
            backgroundType,
            setBackgroundType,
            dotGridVersion,
            setDotGridVersion,
            performanceMode,
            setPerformanceMode: handleSetPerformanceMode
        }}>
            {children}
        </BackgroundContext.Provider>
    );
}

// Simple static grid - no animations, just CSS pattern
function StaticGrid() {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            backgroundColor: '#000000',
            backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
        }} />
    );
}

// Background component that switches based on preference
function BackgroundComponent({ zoomLevel = 0 }) {
    const { backgroundType } = useBackground();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Avoid hydration mismatch
    if (!mounted) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                background: '#000000',
            }} />
        );
    }

    if (backgroundType === BACKGROUND_TYPES.STATIC) {
        return <StaticGrid />;
    }

    if (backgroundType === BACKGROUND_TYPES.GRID) {
        return <DotGrid zoomLevel={zoomLevel} />;
    }

    if (backgroundType === BACKGROUND_TYPES.STARGRID) {
        return <ParticlesBackground zoomLevel={zoomLevel} />;
    }

    // STARMAP - tsparticles version
    return <StarMapBackground zoomLevel={zoomLevel} />;
}

// Memoize to prevent re-renders when parent updates
const Background = memo(BackgroundComponent);
export default Background;

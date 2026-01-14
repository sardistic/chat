"use client";

import { useState, useEffect, createContext, useContext, memo } from 'react';
import DotGrid from './DotGrid';
import ParticlesBackground from './ParticlesBackground';

// Background types
export const BACKGROUND_TYPES = {
    STARMAP: 'starmap',
    GRID: 'grid',
    STATIC: 'static',
};

// Context for background preference
const BackgroundContext = createContext({
    backgroundType: BACKGROUND_TYPES.STARMAP,
    setBackgroundType: () => { },
});

export function useBackground() {
    return useContext(BackgroundContext);
}

// Provider component
export function BackgroundProvider({ children }) {
    const [backgroundType, setBackgroundType] = useState(BACKGROUND_TYPES.STARMAP);
    const [mounted, setMounted] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('backgroundPreference');
        if (saved && Object.values(BACKGROUND_TYPES).includes(saved)) {
            setBackgroundType(saved);
        }
        setMounted(true);
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        if (mounted) {
            localStorage.setItem('backgroundPreference', backgroundType);
        }
    }, [backgroundType, mounted]);

    return (
        <BackgroundContext.Provider value={{ backgroundType, setBackgroundType }}>
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

    return <ParticlesBackground zoomLevel={zoomLevel} />;
}

// Memoize to prevent re-renders when parent updates
const Background = memo(BackgroundComponent);
export default Background;

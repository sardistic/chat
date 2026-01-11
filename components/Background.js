"use client";

import { useState, useEffect, createContext, useContext } from 'react';
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
            background: '#000000',
            backgroundImage: `
                radial-gradient(circle at center, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
        }} />
    );
}

// Background component that switches based on preference
export default function Background({ zoomLevel = 0 }) {
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

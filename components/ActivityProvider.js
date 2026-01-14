"use client";

import { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * ActivityProvider - Tracks activity sources across the app
 * Provides attractor points for particles to gravitate toward
 */

const ActivityContext = createContext({
    attractors: [], // Array of {id, x, y, strength, decay}
    addActivity: () => { },
    registerElement: () => { },
    unregisterElement: () => { },
});

export function useActivity() {
    return useContext(ActivityContext);
}

export function ActivityProvider({ children }) {
    // Registered elements that can emit activity
    const elementsRef = useRef(new Map()); // id -> {x, y, type}

    // Active attractors
    const [attractors, setAttractors] = useState([]);

    // Register an element's position (call on mount/resize)
    const registerElement = useCallback((id, rect, type = 'default') => {
        elementsRef.current.set(id, {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height,
            type
        });
    }, []);

    // Unregister element (call on unmount)
    const unregisterElement = useCallback((id) => {
        elementsRef.current.delete(id);
    }, []);

    // Add activity at an element (triggers particle attraction)
    const addActivity = useCallback((id, strength = 1) => {
        const element = elementsRef.current.get(id);
        if (!element) return;

        // Create attractor at element position
        const attractor = {
            id: `${id}-${Date.now()}`,
            x: element.x,
            y: element.y,
            strength,
            createdAt: Date.now(),
        };

        setAttractors(prev => {
            // Limit to 5 attractors max
            const newAttractors = [...prev, attractor].slice(-5);
            return newAttractors;
        });

        // Decay attractor after 2 seconds
        setTimeout(() => {
            setAttractors(prev => prev.filter(a => a.id !== attractor.id));
        }, 2000);
    }, []);

    return (
        <ActivityContext.Provider value={{
            attractors,
            addActivity,
            registerElement,
            unregisterElement
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

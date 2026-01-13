"use client";

// Failsafe background to debug visibility issues
export default function CssBackground() {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, #4f46e5 0%, #0c0c16 50%, #db2777 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientMove 15s ease infinite',
        }}>
            <style jsx>{`
                @keyframes gradientMove {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>

            {/* Dot Pattern Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
                backgroundSize: '32px 32px'
            }} />
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { SocketProvider } from "@/lib/socket";
import VideoGrid from "@/components/VideoGrid";
import EntryScreen from "@/components/EntryScreen";
import ChatPanel from "@/components/ChatPanel";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useIRC } from "@/hooks/useIRC";
import { useSocket } from "@/lib/socket";

function MainApp({ user, onLeaveRoom }) {
  const roomId = "default-room";
  const { socket, isConnected } = useSocket();
  const {
    localStream,
    peers,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    startBroadcast,
    stopBroadcast,
    error
  } = useWebRTC(roomId, user, false);
  const { ircUsers } = useIRC();

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [activeTab, setActiveTab] = useState('logs');
  const [isResizing, setIsResizing] = useState(false);

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      stopBroadcast();
      setIsBroadcasting(false);
    } else {
      await startBroadcast();
      setIsBroadcasting(true);
    }
  };

  // Resize Logic
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    const constrained = Math.max(280, Math.min(600, newWidth));
    setSidebarWidth(constrained);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="app" style={{ '--dynamic-sidebar-w': `${sidebarWidth}px` }}>

      {/* Main Content Area */}
      <main className="main">
        {/* Card Container similar to Railway's 'Service' cards */}
        <section className="grid-wrap">
          <header className="grid-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3>Production</h3>
              <span className="text-muted" style={{ fontSize: '13px' }}>{peers.size + 1 + ircUsers.size} Services Online</span>
            </div>

            <div className="actions" style={{ display: 'flex', gap: '8px' }}>
              {isBroadcasting && (
                <>
                  <button className="btn" onClick={toggleAudio}>
                    {isAudioEnabled ? '🎤' : '🔇'}
                  </button>
                  <button className="btn" onClick={toggleVideo}>
                    {isVideoEnabled ? '📹' : '🚫'}
                  </button>
                </>
              )}
              <button
                className={`btn ${isBroadcasting ? 'danger' : 'primary'}`}
                onClick={handleToggleBroadcast}
              >
                {isBroadcasting ? 'Stop Stream' : 'Start Stream'}
              </button>
            </div>
          </header>

          <VideoGrid
            localStream={isBroadcasting ? localStream : null}
            peers={peers}
            localUser={user}
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
          />
        </section>

        {/* Status Footer */}
        <div className="status-bar">
          <div className="status-item">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </div>
          <div className="status-item">
            v3.4 (Soft Design)
          </div>
          <div className="status-item" style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={onLeaveRoom}>
            Log Out
          </div>
        </div>
      </main>

      {/* Sidebar (Chat) */}
      {/* Sidebar (Chat & Users) */}
      <aside className="sidebar" style={{ position: 'relative' }}>
        {/* Resize Handle */}
        <div
          className="drag-handle"
          onMouseDown={handleMouseDown}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10 }}
        />

        {/* Sidebar Header / Tabs */}
        <div className="side-header" style={{ padding: '0 12px', gap: '8px' }}>
          <button
            className={`btn ${activeTab === 'logs' ? 'primary' : ''}`}
            style={{ flex: 1, fontSize: '12px', padding: '6px' }}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          <button
            className={`btn ${activeTab === 'services' ? 'primary' : ''}`}
            style={{ flex: 1, fontSize: '12px', padding: '6px' }}
            onClick={() => setActiveTab('services')}
          >
            Services ({peers.size + 1 + ircUsers.size})
          </button>
        </div>

        <div className="side-content" style={{ padding: 0 }}>
          {activeTab === 'logs' ? (
            /* Chat Panel */
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ChatPanel roomId={roomId} user={user} />
            </div>
          ) : (
            /* User List (Services) */
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Local User */}
              <div className="panel-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  👤
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{user.name} (You)</div>
                  <div style={{ fontSize: '11px', color: 'var(--status-online)' }}>● Online</div>
                </div>
              </div>

              {/* Remote Users (WebRTC) */}
              {Array.from(peers, ([socketId, p]) => (
                <div key={socketId} className="panel-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: p.user?.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📹
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>{p.user?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Video Client</div>
                  </div>
                </div>
              ))}

              {/* IRC Users */}
              {ircUsers.size > 0 && <div style={{ marginTop: '8px', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>IRC USERS ({ircUsers.size})</div>}
              {Array.from(ircUsers.values()).map((u) => (
                <div key={u.name} className="panel-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border-subtle)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                    #
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>IRC {u.modes && u.modes.length > 0 ? `[${u.modes.join('')}]` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#F87171', color: 'white', padding: '10px 20px', borderRadius: '8px',
          fontWeight: '500', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [user, setUser] = useState({ name: "Guest", color: "#A78BFA" });

  const handleJoin = (userData) => {
    setUser({ ...userData, color: "#A78BFA" }); // Force purple accent
    setIsRegistered(true);
  };

  const handleLeave = () => {
    setIsRegistered(false);
  };

  return (
    <SocketProvider user={user}>
      {!isRegistered ? (
        <EntryScreen onJoin={handleJoin} />
      ) : (
        <MainApp user={user} onLeaveRoom={handleLeave} />
      )}
    </SocketProvider>
  );
}

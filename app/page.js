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
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setShowProfileMenu(false);
    if (showProfileMenu) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showProfileMenu]);

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      stopBroadcast();
      setIsBroadcasting(false);
    } else {
      await startBroadcast();
      setIsBroadcasting(true);
    }
  };

  // Background Mouse Tracking
  useEffect(() => {
    const handleBgMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    };
    window.addEventListener('mousemove', handleBgMove);
    return () => window.removeEventListener('mousemove', handleBgMove);
  }, []);

  // Resize Logic
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    // Max width: 50% of screen or 800px, whichever is smaller (to avoid breaking on huge screens? or larger?)
    // User asked for "like half the screen".
    const maxWidth = window.innerWidth * 0.5;
    const constrained = Math.max(280, Math.min(maxWidth, newWidth));
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

      {/* Background Layer (Explicit) */}
      <div className="starmap-bg" />

      {/* Fixed Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Logo / Icon */}
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span role="img" aria-label="logo" style={{ fontSize: '18px' }}>🚇</span>
          </div>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
            <span style={{ color: '#888' }}>camsrooms</span>
            <span style={{ color: '#444' }}>/</span>
            <span style={{ color: '#E2E8F0' }}>production</span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Broadcast Controls */}
          {isBroadcasting && (
            <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
              <button className="btn icon-btn" onClick={toggleAudio} title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}>
                {isAudioEnabled ? '🎤' : '🔇'}
              </button>
              <button className="btn icon-btn" onClick={toggleVideo} title={isVideoEnabled ? 'Disable Camera' : 'Enable Camera'}>
                {isVideoEnabled ? '📹' : '🚫'}
              </button>
            </div>
          )}

          <button
            className={`btn ${isBroadcasting ? 'danger' : 'primary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}
            onClick={handleToggleBroadcast}
          >
            {isBroadcasting ? 'Stop Stream' : 'Start Stream'}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Connection Status */}
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} title={isConnected ? 'Connected' : 'Disconnected'} />

          {/* Profile Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn icon-btn pfp-trigger"
              onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
              title="Profile"
              style={{ padding: 0, width: '36px', height: '36px', overflow: 'hidden', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
            >
              <img src={`/api/avatar/${user.name}`} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>

            {showProfileMenu && (
              <div
                className="profile-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Online</div>
                </div>
                <button className="menu-item disabled">Settings</button>
                <button className="menu-item danger" onClick={onLeaveRoom}>Disconnect</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content (Offset by header in CSS) */}
      <div className="app-content">

        {/* Left Stage (Cams) */}
        <div className="main-stage">
          <VideoGrid
            localStream={isBroadcasting ? localStream : null}
            peers={peers}
            localUser={user}
            isVideoEnabled={isVideoEnabled}
            isAudioEnabled={isAudioEnabled}
          />

          {/* Avatar Aquarium */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '100px',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 5,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '24px',
            paddingBottom: '20px'
          }}>
            {/* Collect all users */}
            {[user, ...Array.from(peers.values()).map(p => p.user), ...Array.from(ircUsers.values())].filter(u => u && u.name).map((u, i) => (
              <div key={u.name + i} className="aquarium-avatar">
                <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                  <img
                    src={`/api/avatar/${u.name}`}
                    alt={u.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                  />
                  <div className="avatar-name">
                    {u.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Right Sidebar (Chat) */}
        <aside className="floating-sidebar">
          {/* Resize Handle */}
          <div
            className="drag-handle"
            onMouseDown={handleMouseDown}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10 }}
          />

          {/* Sidebar Tabs */}
          <div className="side-header" style={{ padding: '0 16px', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              className={`btn ${activeTab === 'logs' ? 'primary' : ''}`}
              style={{ flex: 1, fontSize: '12px', padding: '6px', border: 'none', background: activeTab === 'logs' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              onClick={() => setActiveTab('logs')}
            >
              Chat
            </button>
            <button
              className={`btn ${activeTab === 'services' ? 'primary' : ''}`}
              style={{ flex: 1, fontSize: '12px', padding: '6px', border: 'none', background: activeTab === 'services' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              onClick={() => setActiveTab('services')}
            >
              Users ({peers.size + 1 + ircUsers.size})
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
                <div className="user-item">
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img
                      src={`/api/avatar/${user.name}`}
                      alt={user.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name} (You)</div>
                    <div style={{ fontSize: '11px', color: 'var(--status-online)' }}>● Online</div>
                  </div>
                </div>

                {/* Remote Users (WebRTC) */}
                {Array.from(peers, ([socketId, p]) => (
                  <div key={socketId} className="user-item">
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={`/api/avatar/${p.user?.name || 'Guest'}`}
                        alt={p.user?.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Video Client</div>
                    </div>
                  </div>
                ))}

                {/* IRC Users */}
                {ircUsers.size > 0 && <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IRC / Text Only</div>}
                {Array.from(ircUsers.values()).map((u) => (
                  <div key={u.name} className="user-item">
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={`/api/avatar/${u.name}`}
                        alt={u.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                        <span style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px', background: '#333', color: '#888', fontWeight: 'bold' }}>IRC</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.modes && u.modes.length > 0 ? `+${u.modes.join('')}` : 'Remote User'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

      </div>

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

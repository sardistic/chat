"use client";

import { useState, useEffect, useCallback } from "react";
import { SocketProvider } from "@/lib/socket";
import VideoGrid from "@/components/VideoGrid";
import EntryScreen from "@/components/EntryScreen";
import ChatPanel from "@/components/ChatPanel";
import ProfileModal from "@/components/ProfileModal";
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
    isDeafened,
    toggleAudio,
    toggleVideo,
    toggleDeaf,
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
  const [showOwnProfile, setShowOwnProfile] = useState(false);
  const [showStatusInput, setShowStatusInput] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setShowProfileMenu(false);
    if (showProfileMenu) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showProfileMenu]);

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      try {
        stopBroadcast();
      } catch (err) {
        console.error("Error stopping broadcast:", err);
      } finally {
        setIsBroadcasting(false);
      }

      // System Notification
      if (socket) {
        socket.emit('chat-message', {
          roomId,
          sender: 'System',
          text: `💤 ${user.name} went offline.`,
          type: 'system',
          timestamp: new Date().toISOString()
        });
      }

    } else {
      try {
        await startBroadcast();
        setIsBroadcasting(true);

        // System Notification
        if (socket) {
          socket.emit('chat-message', {
            roomId,
            sender: 'System',
            text: `🔴 ${user.name} is now LIVE!`,
            type: 'system',
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Error starting broadcast:", err);
        setIsBroadcasting(false);
      }
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

  // Chat Bubble Logic
  const [chatBubbles, setChatBubbles] = useState({});

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      // console.log("BUBBLE: Received", msg);

      const author = msg.author || msg.sender;
      const content = msg.content || msg.text;

      if (!author || !content) return;

      // Update bubble state
      setChatBubbles(prev => ({
        ...prev,
        [author]: content
      }));

      // Clear after 6 seconds
      setTimeout(() => {
        setChatBubbles(prev => {
          // Only clear if the current message matches the one we set (handle overlaps)
          if (prev[author] === content) {
            const newState = { ...prev };
            delete newState[author];
            return newState;
          }
          return prev;
        });
      }, 6000);
    };

    socket.on('chat-message', handleMessage);
    return () => {
      socket.off('chat-message', handleMessage);
    };
  }, [socket]);

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
            <button
              onClick={onLeaveRoom}
              className="text-btn"
              style={{ color: '#888', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
            >
              chat
            </button>
            <span style={{ color: '#444' }}>/</span>
            <span style={{ color: '#E2E8F0' }}>production</span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Broadcast Controls */}
          {/* Deafen (Always Visible) */}
          <button
            className={`btn icon-btn ${isDeafened ? 'danger' : ''}`}
            onClick={toggleDeaf}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
            style={{ marginRight: '8px' }}
          >
            {isDeafened ? '🙉' : '🎧'}
          </button>

          {/* Broadcast Controls */}
          {isBroadcasting && (
            <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
              <button className={`btn icon-btn ${!isAudioEnabled ? 'danger' : ''}`} onClick={toggleAudio} title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}>
                {isAudioEnabled ? '🎤' : '🔇'}
              </button>
            </div>
          )}

          <button
            className={`btn ${isBroadcasting ? 'danger' : 'primary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}
            onClick={handleToggleBroadcast}
          >
            {isBroadcasting ? 'Stream Off' : 'Stream'}
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
              <img src={user.avatar || user.image || `/api/avatar/${user.name}`} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>

            {showProfileMenu && (
              <div
                className="profile-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{user.globalName || user.name}</div>
                  <div style={{ fontSize: '11px', color: '#3ba55d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#3ba55d', borderRadius: '50%', display: 'inline-block' }}></span>
                    {customStatus || 'Online'}
                  </div>
                </div>
                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowOwnProfile(true); }}>👤 View Profile</button>
                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowStatusInput(true); }}>💬 Set Status</button>
                <button className="menu-item disabled">⚙️ Settings</button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                <button className="menu-item danger" onClick={onLeaveRoom}>🚪 Disconnect</button>
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
            isDeafened={isDeafened}
            roomId={roomId}
          />

          {/* Avatar Aquarium */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '140px', /* Increased height for bubbles */
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 5,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '24px',
            paddingBottom: '20px'
          }}>
            {/* Collect & Deduplicate Users */}
            {(() => {
              const uniqueMap = new Map();
              // Priority: Local -> Peer -> IRC (don't overwrite existing entries)
              if (user && user.name) uniqueMap.set(user.name, user);
              peers.forEach(p => { if (p.user && p.user.name && !uniqueMap.has(p.user.name)) uniqueMap.set(p.user.name, p.user); });
              ircUsers.forEach(u => { if (u && u.name && !uniqueMap.has(u.name)) uniqueMap.set(u.name, u); });

              return Array.from(uniqueMap.values())
                .filter(u => !['camroomslogbot', 'chatlogbot'].includes(u.name.toLowerCase())) // Hide Bot
                .map((u, i) => {
                  const bubble = chatBubbles[u.name];
                  return (
                    <div
                      key={u.name + i}
                      className="aquarium-avatar"
                      style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={() => setSelectedProfileUser(u)}
                    >

                      {/* Chat Bubble */}
                      {bubble && (
                        <div className="chat-bubble">
                          {bubble}
                        </div>
                      )}

                      <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                        <img
                          src={u.avatar || `/api/avatar/${u.name}`}
                          alt={u.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                        />
                        <div className="avatar-name">
                          {u.name}
                        </div>
                      </div>
                    </div>
                  );
                });
            })()}
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
                <ChatPanel
                  roomId={roomId}
                  user={user}
                  users={Array.from(peers.values())}
                  ircUsers={Array.from(ircUsers.values())}
                />
              </div>
            ) : (
              /* User List (Services) */
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Local User */}
                <div className="user-item">
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img
                      src={user.avatar || `/api/avatar/${user.name}`}
                      alt={user.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name} (You)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px' }}>
                      <span title="Online" style={{ color: 'var(--status-online)' }}>●</span>
                      {isVideoEnabled ? <span title="Broadcasting">📹</span> : <span title="Viewing">👁️</span>}
                      {!isAudioEnabled && <span title="Muted">🔇</span>}
                      {isDeafened && <span title="Deafened">🙉</span>}
                    </div>
                  </div>
                </div>

                {/* Remote Users (WebRTC) */}
                {Array.from(peers, ([socketId, p]) => (
                  <div key={socketId} className="user-item" onClick={() => setSelectedProfileUser(p.user)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={p.user?.avatar || `/api/avatar/${p.user?.name || 'Guest'}`}
                        alt={p.user?.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px' }}>
                        {p.user?.isVideoEnabled ? <span title="Broadcasting">📹</span> : <span title="Viewing">👁️</span>}
                        {p.user?.isAudioEnabled === false && <span title="Muted">🔇</span>}
                        {p.user?.isDeafened && <span title="Deafened">🙉</span>}
                        {!p.user?.isVideoEnabled && !p.user?.isAudioEnabled && <span title="Lurking">☁️</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* IRC Users */}
                {ircUsers.size > 0 && <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IRC / Text Only</div>}
                {/* IRC Users (Humans) */}
                {Array.from(ircUsers.values())
                  .filter(u => !['camroomslogbot', 'chatlogbot', 'chanserv'].includes(u.name.toLowerCase()))
                  .map((u) => (
                    <div key={u.name} className="user-item" onClick={() => setSelectedProfileUser(u)} style={{ cursor: 'pointer' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img
                          src={u.avatar || `/api/avatar/${u.name}`}
                          alt={u.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                          <span style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px', background: '#333', color: '#888', fontWeight: 'bold' }}>IRC</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px' }}>
                          <span title="Text Only">⌨️</span>
                          {u.modes && u.modes.length > 0 && <span>+{u.modes.join('')}</span>}
                        </div>
                      </div>
                    </div>
                  ))}

                {/* System Bots */}
                <div style={{ marginTop: '16px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  System
                </div>
                {Array.from(ircUsers.values())
                  .filter(u => ['camroomslogbot', 'chanserv'].includes(u.name.toLowerCase()))
                  .map((u) => {
                    let displayName = u.name;
                    let role = 'BOT';
                    let description = 'System Bot';

                    if (u.name.toLowerCase() === 'camroomslogbot' || u.name.toLowerCase() === 'chatlogbot') {
                      displayName = 'LogBot';
                      role = 'OFFICIAL';
                      description = 'Archives & Logs';
                    } else if (u.name.toLowerCase() === 'chanserv') {
                      displayName = 'ChanServ';
                      role = 'SERVICE';
                      description = 'Channel Services';
                    }

                    return (
                      <div key={u.name} className="user-item" style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)' }}>
                          <span style={{ fontSize: '18px' }}>🤖</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                            <span style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px', background: 'white', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{role}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>{description}</div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* Own Profile Modal */}
      <ProfileModal
        user={{ ...user, customStatus }}
        isOpen={showOwnProfile}
        onClose={() => setShowOwnProfile(false)}
      />

      {/* Selected User Profile Modal */}
      <ProfileModal
        user={selectedProfileUser}
        isOpen={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
      />

      {/* Status Input Dialog */}
      {showStatusInput && (
        <div className="profile-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="profile-modal" style={{ padding: '20px', width: '300px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Set Custom Status</h3>
            <input
              type="text"
              placeholder="What's on your mind?"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              maxLength={50}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                marginBottom: '12px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setShowStatusInput(false);
                if (e.key === 'Escape') { setCustomStatus(''); setShowStatusInput(false); }
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => { setCustomStatus(''); setShowStatusInput(false); }}
                style={{ padding: '8px 16px' }}
              >
                Clear
              </button>
              <button
                className="btn primary"
                onClick={() => setShowStatusInput(false)}
                style={{ padding: '8px 16px' }}
              >
                Save
              </button>
            </div>
          </div>
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

  const handleLeave = async () => {
    // Clear guest cookies
    document.cookie = 'guest_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'display_name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'avatar_seed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Sign out of NextAuth (if logged in with Discord)
    try {
      const { signOut } = await import('next-auth/react');
      await signOut({ redirect: false });
    } catch (e) {
      // Ignore if not signed in
    }

    // Reset to entry screen
    setUser(null);
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { SocketProvider } from "@/lib/socket";
import VideoGrid from "@/components/VideoGrid";
import EntryScreen from "@/components/EntryScreen";
import ChatPanel from "@/components/ChatPanel";
import { useWebRTC } from "@/hooks/useWebRTC";
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
  } = useWebRTC(roomId, user, false); // false = don't auto-start camera

  // UI State
  const [presenceStatus, setPresenceStatus] = useState('online');
  const [userListMode, setUserListMode] = useState('compact'); // compact by default
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handlePresenceChange = (status) => {
    setPresenceStatus(status);
    if (socket) {
      socket.emit('presence-change', { status });
    }
  };

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      stopBroadcast();
      setIsBroadcasting(false);
    } else {
      await startBroadcast();
      setIsBroadcasting(true);
    }
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;

    // Calculate new width based on mouse position from right edge
    const newWidth = window.innerWidth - e.clientX;

    // Apply constraints: min 300px, max 85% of screen (allow cams to get very small)
    const maxWidth = window.innerWidth * 0.85;
    const constrainedWidth = Math.max(300, Math.min(maxWidth, newWidth));
    setSidebarWidth(constrainedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Cleanup styles
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="app" style={{
      '--dynamic-sidebar-w': `${sidebarWidth}px`
    }}>
      {/* -- CONDENSED TOPBAR -- */}
      <header className="topbar" style={{ padding: '0 20px', height: '48px' }}>
        <div className="brand">
          <div className="logo" aria-hidden="true"></div>
          <h1 style={{ fontSize: '16px', margin: 0 }}>chat</h1>
        </div>

        <div className="top-actions">
          <div
            className="pill"
            style={{ padding: '6px 12px', cursor: 'pointer', transition: 'all .2s' }}
            onClick={() => setUserListMode(userListMode === 'compact' ? 'full' : 'compact')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 212, 255, .15)';
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, .4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
              e.currentTarget.style.borderColor = '';
            }}
          >
            <span className="dot" aria-hidden="true"></span>
            <span className="label" style={{ fontSize: '12px' }}>Online • {peers.size + 1}</span>
          </div>
        </div>

        <div className="user-actions">
          <button
            className="btn"
            type="button"
            onClick={() => handlePresenceChange(presenceStatus === 'online' ? 'away' : 'online')}
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            {presenceStatus === 'online' ? '🟢' : '🟡'} {presenceStatus}
          </button>
          <button
            className="btn danger"
            type="button"
            style={{ color: user.color, padding: '8px 12px', fontSize: '12px' }}
            onClick={onLeaveRoom}
          >
            {user.name}
          </button>
        </div>
      </header>

      {/* -- MAIN STAGE -- */}
      <div className="status-bar">
        <div className="status-item">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          {isConnected ? 'Socket Connected' : 'Disconnected'}
        </div>
        <div className="status-item">
          Build: v3.0 (Mesh + Crash Fix)
        </div>
      </div>
      <main className="main">
        <div className="stage">
          <div className="stage-header" style={{ padding: '12px', minHeight: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="room-meta">
              <div className="room-title" style={{ fontSize: '14px' }}>Default Room</div>
              <div className="room-tags" style={{ marginTop: '4px' }}>
                <span className="chip" style={{ fontSize: '11px' }}><b>{peers.size + (isBroadcasting ? 1 : 0)}</b> cams</span>
                <span
                  className="chip"
                  style={{ fontSize: '11px', cursor: 'pointer', transition: 'all .2s' }}
                  onClick={() => setUserListMode(userListMode === 'compact' ? 'full' : 'compact')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, .2)';
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 255, .5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '';
                    e.currentTarget.style.borderColor = '';
                  }}
                >
                  <b>{peers.size + 1}</b> users
                </span>
              </div>
            </div>

            {/* Media Controls in Header */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              {/* Cam Up Button - Most Prominent */}
              <button
                onClick={handleToggleBroadcast}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: isBroadcasting ? '2px solid #ef4444' : '2px solid #00d4ff',
                  background: isBroadcasting
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, .3), rgba(239, 68, 68, .15))'
                    : 'linear-gradient(135deg, rgba(0, 212, 255, .3), rgba(0, 212, 255, .15))',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all .2s',
                  boxShadow: isBroadcasting
                    ? '0 4px 16px rgba(239, 68, 68, .3)'
                    : '0 4px 16px rgba(0, 212, 255, .3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isBroadcasting ? '📹 Stop Cam' : '📹 Cam Up'}
              </button>

              {/* Mute/Video Controls - Only show when broadcasting */}
              {isBroadcasting && (
                <>
                  <button
                    onClick={toggleAudio}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, .2)',
                      background: isAudioEnabled ? 'rgba(255, 255, 255, .1)' : 'rgba(239, 68, 68, .2)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all .2s'
                    }}
                  >
                    {isAudioEnabled ? '🎤' : '🔇'}
                  </button>
                  <button
                    onClick={toggleVideo}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, .2)',
                      background: isVideoEnabled ? 'rgba(255, 255, 255, .1)' : 'rgba(239, 68, 68, .2)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all .2s'
                    }}
                  >
                    {isVideoEnabled ? '📹' : '📹'}
                  </button>
                </>
              )}
            </div>
          </div>

          <section className="grid-wrap" aria-label="Video grid">
            <VideoGrid
              localStream={isBroadcasting ? localStream : null}
              peers={peers}
              localUser={user}
              isVideoEnabled={isVideoEnabled}
              isAudioEnabled={isAudioEnabled}
            />
          </section>
        </div>
      </main>

      {/* -- SIDEBAR with Resize Handle -- */}
      <aside className="sidebar" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            cursor: 'ew-resize',
            background: isResizing ? 'rgba(0, 212, 255, .6)' : 'rgba(255, 255, 255, .05)',
            transition: 'background .2s',
            zIndex: 1000,
            borderRight: isResizing ? '1px solid rgba(0, 212, 255, .8)' : '1px solid rgba(255, 255, 255, .1)'
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.target.style.background = 'rgba(0, 212, 255, .3)';
              e.target.style.borderRight = '1px solid rgba(0, 212, 255, .5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.target.style.background = 'rgba(255, 255, 255, .05)';
              e.target.style.borderRight = '1px solid rgba(255, 255, 255, .1)';
            }
          }}
        />



        {/* Chat Panel - Expands to fill available space */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <ChatPanel roomId={roomId} user={user} />

          {/* Floating User Avatars - Positioned absolutely over chat */}
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10
          }}>
            {/* Current User Avatar */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${user.color}88, ${user.color}55)`,
                border: '3px solid rgba(255, 255, 255, .3)',
                cursor: 'pointer',
                transition: 'all .3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: `0 4px 16px ${user.color}60, 0 0 20px ${user.color}30`,
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => setUserListMode(userListMode === 'compact' ? 'full' : 'compact')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15) rotate(5deg)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${user.color}80, 0 0 30px ${user.color}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                e.currentTarget.style.boxShadow = `0 4px 16px ${user.color}60, 0 0 20px ${user.color}30`;
              }}
            >
              {/* Character sprite avatar */}
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    imageRendering: 'pixelated'
                  }}
                />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  👤
                </div>
              )}
              {/* Online indicator */}
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: presenceStatus === 'online' ? '#10b981' : '#f59e0b',
                border: '2px solid rgba(0, 0, 0, .8)',
                boxShadow: '0 0 8px rgba(0, 0, 0, .5)'
              }}></div>

              {/* Cute tooltip */}
              <div className="user-tooltip">
                <div className="name">You</div>
                <div className="status">Online</div>
              </div>
            </div>

            {/* Other User Avatars */}
            {Array.from(peers.entries()).slice(0, 5).map(([peerId, peerData], index) => {
              const peerUser = peerData?.user || {};
              const peerColor = peerUser.color || '#888';
              const peerAvatar = peerUser.avatar;

              return (
                <div
                  key={peerId}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: peerAvatar
                      ? `linear-gradient(135deg, ${peerColor}88, ${peerColor}55)`
                      : 'linear-gradient(135deg, rgba(255, 255, 255, .2), rgba(255, 255, 255, .08))',
                    border: `3px solid ${peerColor}40`,
                    cursor: 'pointer',
                    transition: 'all .3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: `0 4px 12px ${peerColor}40`,
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `slideIn 0.4s ease-out ${index * 0.1}s both`
                  }}
                  onClick={() => setUserListMode(userListMode === 'compact' ? 'full' : 'compact')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15) rotate(-5deg)';
                    e.currentTarget.style.boxShadow = `0 8px 20px ${peerColor}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                    e.currentTarget.style.boxShadow = `0 4px 12px ${peerColor}40`;
                  }}
                >
                  {peerAvatar ? (
                    <img
                      src={peerAvatar}
                      alt={peerUser.name || 'User'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        imageRendering: 'pixelated'
                      }}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      👤
                    </div>
                  )}
                  {/* Online indicator */}
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#10b981',
                    border: '2px solid rgba(0, 0, 0, .8)',
                    boxShadow: '0 0 8px rgba(0, 0, 0, .5)'
                  }}></div>

                  {/* Cute tooltip */}
                  <div className="user-tooltip">
                    <div className="name">{peerData.user?.name || 'User'}</div>
                    <div className="status">Online</div>
                  </div>
                </div>
              );
            })}

            {/* More users indicator */}
            {peers.size > 5 && (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, .4)',
                border: '3px solid rgba(255, 255, 255, .15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--muted)',
                cursor: 'pointer',
                transition: 'all .3s'
              }}
                onClick={() => setUserListMode('full')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.background = 'rgba(0, 212, 255, .2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = 'rgba(0, 0, 0, .4)';
                }}
              >
                +{peers.size - 5}
              </div>
            )}
          </div>

          {/* Expanded User List Panel - Slides in from right */}
          <div style={{
            position: 'absolute',
            right: userListMode === 'full' ? '0' : '-100%',
            top: 0,
            bottom: 0,
            width: '100%',
            background: 'rgba(10, 14, 26, .98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, .1)',
            borderRadius: '16px',
            transition: 'right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            zIndex: 20,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 0, 0, .5)'
          }}>
            <div className="ph" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, .1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="t" style={{ fontSize: '14px', fontWeight: '700' }}>Users</div>
                <div className="count" style={{
                  background: 'rgba(0, 212, 255, .2)',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#00d4ff'
                }}>{peers.size + 1}</div>
              </div>
              <button
                onClick={() => setUserListMode('compact')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, .15)',
                  background: 'rgba(255, 255, 255, .08)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all .2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, .15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, .08)';
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '12px', overflowY: 'auto', maxHeight: 'calc(100% - 60px)' }}>
              {/* Current User - Full View */}
              <div className="u" style={{
                padding: '12px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${user.color}20, ${user.color}10)`,
                border: `1px solid ${user.color}40`,
                marginBottom: '8px'
              }}>
                <div className="left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${user.color}88, ${user.color}55)`,
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: presenceStatus === 'online' ? '#10b981' : '#f59e0b',
                      border: '2px solid rgba(0, 0, 0, .8)'
                    }}></div>
                  </div>
                  <div>
                    <div style={{ color: user.color, fontWeight: '700', fontSize: '14px' }}>{user.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '11px' }}>You • {presenceStatus}</div>
                  </div>
                </div>
              </div>

              {/* Other Users - Full View */}
              {Array.from(peers.entries()).map(([peerId, peerData]) => {
                const peerUser = peerData?.user || {};
                const peerColor = peerUser.color || '#888';
                const peerName = peerUser.name || `User ${peerId.slice(0, 6)}`;
                const peerAvatar = peerUser.avatar;

                return (
                  <div key={peerId} className="u" style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${peerColor}15, ${peerColor}08)`,
                    border: `1px solid ${peerColor}20`,
                    marginBottom: '8px',
                    transition: 'all .2s'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${peerColor}25, ${peerColor}15)`;
                      e.currentTarget.style.borderColor = `${peerColor}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${peerColor}15, ${peerColor}08)`;
                      e.currentTarget.style.borderColor = `${peerColor}20`;
                    }}
                  >
                    <div className="left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${peerColor}88, ${peerColor}55)`,
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {peerAvatar ? (
                          <img
                            src={peerAvatar}
                            alt={peerName}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              imageRendering: 'pixelated'
                            }}
                          />
                        ) : (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                          }}>
                            👤
                          </div>
                        )}
                        <div style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#10b981',
                          border: '2px solid rgba(0, 0, 0, .8)'
                        }}></div>
                      </div>
                      <div>
                        <div style={{ color: peerColor, fontWeight: '700', fontSize: '14px' }}>{peerName}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '11px' }}>online</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .user-tooltip {
          position: absolute;
          right: 60px;
          top: 50%;
          transform: translateY(-50%) translateX(10px) scale(0.9);
          background: rgba(10, 14, 26, 0.9);
          backdrop-filter: blur(12px);
          padding: 8px 12px;
          border-radius: 12px;
          color: white;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 100;
        }

        .user-tooltip .name {
          font-size: 13px;
          font-weight: 700;
          color: white;
        }

        .user-tooltip .status {
          font-size: 10px;
          color: #00d4ff;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Hover animation trigger */
        div:hover > .user-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0) scale(1);
        }
      `}</style>

      {
        error && (
          <div style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontSize: '14px'
          }}>
            {error}
          </div>
        )
      }
    </div >
  );
}

export default function Home() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [user, setUser] = useState({ name: "Guest", color: "#00d4ff" });

  const handleJoin = (userData) => {
    setUser(userData);
    setIsRegistered(true);
  };

  const handleLeave = () => {
    setIsRegistered(false);
  };

  return (
    <SocketProvider user={user}>
      {!isRegistered ? (
        <div className="entry-overlay">
          <EntryScreen onJoin={handleJoin} />
        </div>
      ) : (
        <MainApp user={user} onLeaveRoom={handleLeave} />
      )}
    </SocketProvider>
  );
}

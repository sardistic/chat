"use client";

import { useState, useEffect, useCallback } from "react";
import { getCookie, setCookie } from 'cookies-next';
import { Icon } from '@iconify/react';
import { SocketProvider } from "@/lib/socket";
import VideoGrid from "@/components/VideoGrid";
import EntryScreen from "@/components/EntryScreen";
import ChatPanel from "@/components/ChatPanel";
import ProfileModal from "@/components/ProfileModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useIRC } from "@/hooks/useIRC";
import { useSocket } from "@/lib/socket";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useChat } from "@/hooks/useChat";
import SettingsModal from "@/components/SettingsModal";
import AdminModal from "@/components/AdminModal";


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
  const { ircUsers, sendMessage: sendToIRC } = useIRC(user);
  const chat = useChat(roomId, user);
  const { isBuilding, blockedIds, typingUsers } = chat;

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false); // Admin Modal

  // State initialization with cookie fallback
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = getCookie('sidebarWidth');
    return saved ? parseInt(saved, 10) : 340;
  });

  // Persist sidebar width & Validation
  useEffect(() => {
    const timer = setTimeout(() => {
      setCookie('sidebarWidth', sidebarWidth, { maxAge: 60 * 60 * 24 * 365 }); // 1 year
    }, 500); // Debounce
    return () => clearTimeout(timer);
  }, [sidebarWidth]);

  // Ensure width is valid on mount/resize
  useEffect(() => {
    const validateWidth = () => {
      const maxWidth = window.innerWidth * 0.5;
      const validWidth = Math.max(280, Math.min(maxWidth, sidebarWidth));
      if (validWidth !== sidebarWidth) {
        setSidebarWidth(validWidth);
      }
    };
    validateWidth(); // Check on mount
    window.addEventListener('resize', validateWidth);
    return () => window.removeEventListener('resize', validateWidth);
  }, [sidebarWidth]);

  const [activeTab, setActiveTab] = useState('logs');
  const [isResizing, setIsResizing] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showOwnProfile, setShowOwnProfile] = useState(false);
  const [showStatusInput, setShowStatusInput] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [modalPosition, setModalPosition] = useState(null);
  const [peerSettings, setPeerSettings] = useState({}); // { [userId]: { volume: 1, muted: false, hidden: false } }
  const [mentionCounts, setMentionCounts] = useState({});
  const [chatReactions, setChatReactions] = useState([]);
  const { tubeState, receivedAt, updateTubeState, isOwner: isTubeOwner } = useYouTubeSync(roomId, user);

  const handleUpdatePeerSettings = (userId, newSettings) => {
    setPeerSettings(prev => ({
      ...prev,
      [userId]: { ...prev[userId], ...newSettings }
    }));
  };

  const handleProfileClick = (user, e) => {
    e?.stopPropagation();
    setSelectedProfileUser(user);
    if (e?.clientX) {
      setModalPosition({ x: e.clientX, y: e.clientY });
    } else {
      setModalPosition(null); // Center if no event
    }
  };

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
      // Server handles cam status notification via update-user handler

    } else {
      try {
        await startBroadcast();
        setIsBroadcasting(true);
        // Server handles cam status notification via update-user handler
      } catch (err) {
        console.error("Error starting broadcast:", err);
        setIsBroadcasting(false);
      }
    }
  };

  const handleTubeMuteChange = (isUnmuted) => {
    // 1. Update socket state for OTHERS
    if (socket && roomId) {
      socket.emit('update-user', { isTubeUnmuted: isUnmuted });
    }
    // 2. We don't need to manually update local user state here because 
    // the 'user' object in render is handled via SocketProvider/useWebRTC,
    // but 'user' prop passed to MainApp is static initial state?
    // Wait, 'user' arg to MainApp is initial. We need to force a re-render or update local state.
    // But actually, 'useWebRTC' has 'peers', but for local user...
    // Let's add it to a local state extension if needed, or rely on a "wrapper" user object.
    // Actually, simplest is to just track it in a ref or state for the local render.
  };

  // Track local mute state for immediate feedback
  const [isLocalTubeUnmuted, setIsLocalTubeUnmuted] = useState(false);

  const onMuteChange = (isUnmuted) => {
    setIsLocalTubeUnmuted(isUnmuted);
    handleTubeMuteChange(isUnmuted);
  };

  // Background Mouse Tracking
  useEffect(() => {
    const handleBgMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}% `);
      document.documentElement.style.setProperty('--mouse-y', `${y}% `);
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

      // 1. Detect Mentions for Camera Glow (Target gets glow)
      const mentionedUsers = [];
      const allKnownUsers = [...peers.values().map(p => p.user?.name), user?.name].filter(Boolean);
      allKnownUsers.forEach(name => {
        if (content.includes(`@${name} `)) {
          mentionedUsers.push(name);
        }
      });

      if (mentionedUsers.length > 0) {
        setMentionCounts(prev => {
          const newCounts = { ...prev };
          mentionedUsers.forEach(u => newCounts[u] = (newCounts[u] || 0) + 1);
          return newCounts;
        });
        // Clear mention glow after 3s
        setTimeout(() => {
          setMentionCounts(prev => {
            const newCounts = { ...prev };
            mentionedUsers.forEach(u => {
              if (newCounts[u] > 0) newCounts[u]--;
            });
            return newCounts;
          });
        }, 3000);
      }

      // 2. Detect Single Emojis for Floating Reactions (Sender emits reaction)
      // Simple regex for single emoji
      const isEmoji = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]){1,4}$/.test(content.trim());
      if (isEmoji) {
        const emoji = content.trim();
        setChatReactions(prev => [...prev, { sender: author, emoji, id: Date.now() }]);
      }

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
      document.body.classList.add('resizing');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className={`app ${isBuilding ? 'building-mode' : ''} `} style={{ '--dynamic-sidebar-w': `${sidebarWidth} px` }}>

      {/* Background Layer (Explicit) */}
      <div className="starmap-bg" />

      {/* Fixed Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Logo / Icon - Removed */}
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
            <img
              src="https://i.imgur.com/MfbxoHW.gif"
              alt="gem"
              style={{ height: '20px', marginRight: '4px' }}
            />
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

          {/* Avatar Aquarium - to the left of controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginRight: '8px'
          }}>
            {(() => {
              const uniqueMap = new Map();
              if (user && user.name) uniqueMap.set(user.name, user);
              peers.forEach(p => { if (p.user && p.user.name && !uniqueMap.has(p.user.name)) uniqueMap.set(p.user.name, p.user); });
              ircUsers.forEach(u => { if (u && u.name && !uniqueMap.has(u.name)) uniqueMap.set(u.name, u); });
              return Array.from(uniqueMap.values())
                .filter(u => !['camroomslogbot', 'chatlogbot'].includes(u.name.toLowerCase()))
                .map((u, i) => {
                  const isUserTyping = typingUsers.includes(u.name);
                  const base = u.avatar || `/ api / avatar / ${u.name} `;
                  // Only animate if it's our internal avatar API
                  let avatarUrl = base;
                  if (isUserTyping && base.includes('/api/avatar')) {
                    const hasQuery = base.includes('?');
                    avatarUrl = `${base}${hasQuery ? '&' : '?'} expr = typing`;
                  }
                  return (
                    <div
                      key={u.name + i}
                      className="aquarium-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => handleProfileClick(u, e)}
                      title={u.name}
                    >
                      <img
                        src={avatarUrl}
                        alt={u.name}
                        className={tubeState?.playing && ((u.name === user.name) ? isLocalTubeUnmuted : u.isTubeUnmuted) ? 'dancing' : ''}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>
                  )
                });
            })()}
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

          {/* Broadcast Controls */}
          {/* Deafen (Always Visible) */}
          <button
            className={`btn icon - btn ${isDeafened ? 'danger' : ''} `}
            onClick={toggleDeaf}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
            style={{ marginRight: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isDeafened ? <Icon icon="fa:headphones" width="18" style={{ opacity: 0.5 }} /> : <Icon icon="fa:headphones" width="18" />}
          </button>

          {/* Broadcast Controls */}
          {isBroadcasting && (
            <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
              <button
                className="broadcast-btn"
                onClick={toggleAudio}
                title={isAudioEnabled ? "Mute" : "Unmute"}
                style={{ background: isAudioEnabled ? 'rgba(255,255,255,0.1)' : '#ff4444' }}
              >
                {isAudioEnabled ? <Icon icon="fa:microphone" width="20" /> : <Icon icon="fa:microphone-slash" width="20" style={{ opacity: 0.5 }} />}
              </button>

            </div>
          )}

          <button
            className={`btn ${isBroadcasting ? 'danger' : 'primary'} `}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px' }}
            onClick={handleToggleBroadcast}
          >
            {isBroadcasting ? 'Stream Off' : 'Stream'}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Connection Status */}
          <div className={`status - dot ${isConnected ? 'connected' : 'disconnected'} `} title={isConnected ? 'Connected' : 'Disconnected'} />

          {/* Profile Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn icon-btn pfp-trigger"
              onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }}
              title="Profile"
              style={{ padding: 0, width: '36px', height: '36px', overflow: 'hidden', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
            >
              <img src={user.avatar || user.image || `/ api / avatar / ${user.name} `} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowOwnProfile(true); }}>
                  <Icon icon="fa:user" width="16" /> View Profile
                </button>
                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowStatusInput(true); }}>
                  <Icon icon="fa:comment" width="16" /> Set Status
                </button>
                <button className="menu-item disabled">
                  <Icon icon="fa:cog" width="16" /> Settings
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                <button className="menu-item danger" onClick={onLeaveRoom}>
                  <Icon icon="fa:sign-out" width="16" /> Disconnect
                </button>
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
            peerSettings={peerSettings}
            onUpdatePeerSettings={handleUpdatePeerSettings}
            onProfileClick={handleProfileClick}
            typingUsers={typingUsers}
            mentionCounts={mentionCounts}
            chatReactions={chatReactions}
            tubeState={tubeState}
            receivedAt={receivedAt}
            onUpdateTubeState={updateTubeState}
            isTubeOwner={isTubeOwner}
            blockedIds={blockedIds}
            onMuteChange={onMuteChange}
          />
        </div>

        {/* Floating Right Sidebar (Chat) */}
        <aside className="floating-sidebar">
          {/* Resize Handle */}
          <div
            className={`drag-handle ${isBuilding ? 'active-pulse' : ''} `}
            onMouseDown={handleMouseDown}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10 }}
          />

          {/* Sidebar Tabs */}
          <div className="side-header" style={{ padding: '0 16px', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              className={`btn ${activeTab === 'logs' ? 'primary' : ''} `}
              style={{ flex: 1, fontSize: '12px', padding: '6px', border: 'none', background: activeTab === 'logs' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              onClick={() => setActiveTab('logs')}
            >
              Chat
            </button>
            <button
              className={`btn ${activeTab === 'services' ? 'primary' : ''} `}
              style={{ flex: 1, fontSize: '12px', padding: '6px', border: 'none', background: activeTab === 'services' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              onClick={() => setActiveTab('services')}
            >
              Users ({(() => {
                // Deduplicate: count web users + IRC users not already in web
                const webUserNames = new Set([user.name, ...Array.from(peers.values()).map(p => p.user?.name).filter(Boolean)]);
                const uniqueIrcCount = Array.from(ircUsers.values()).filter(u => !webUserNames.has(u.name)).length;
                return webUserNames.size + uniqueIrcCount;
              })()})
            </button>
          </div>

          <div className="side-content" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Chat Panel - Always mounted to preserve state */}
            <div style={{ flex: 1, height: '100%', display: activeTab === 'logs' ? 'flex' : 'none', flexDirection: 'column' }}>
              <ChatPanel
                roomId={roomId}
                user={user}
                users={Array.from(peers.values())}
                ircUsers={Array.from(ircUsers.values())}
                onUserClick={handleProfileClick}
                sendToIRC={sendToIRC}
                {...chat}
              />
            </div>

            {/* User List (Services) - Always mounted for consistency */}
            <div style={{ padding: '16px', display: activeTab === 'services' ? 'flex' : 'none', flexDirection: 'column', gap: '8px' }}>
              {/* Local User */}
              <div className="user-item">
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img
                    src={user.avatar || `/ api / avatar / ${user.name} `}
                    alt={user.name}
                    className=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name} (You)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px', alignItems: 'center' }}>
                    <Icon icon="fa:circle" width="10" color="var(--status-online)" />
                    {isVideoEnabled ? <Icon icon="fa:video-camera" width="14" /> : <Icon icon="fa:eye" width="14" />}
                    {!isAudioEnabled && <Icon icon="fa:microphone-slash" width="14" />}
                    {isDeafened && <Icon icon="fontelico:headphones" width="14" style={{ opacity: 0.5 }} />}
                  </div>
                </div>
              </div>

              {/* Remote Users (WebRTC) */}
              {Array.from(peers, ([socketId, p]) => {
                // Skip if it's the local user
                if (p.user?.name === user.name) return null;

                return (
                  <div key={socketId} className="user-item" onClick={(e) => handleProfileClick(p.user, e)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={p.user?.avatar || `/ api / avatar / ${p.user?.name || 'Guest'} `}
                        alt={p.user?.name}
                        className=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.user?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px', alignItems: 'center' }}>
                        {p.user?.isVideoEnabled ? <Icon icon="fa:video-camera" width="14" /> : <Icon icon="fa:eye" width="14" />}
                        {p.user?.isAudioEnabled === false && <Icon icon="fa:microphone-slash" width="14" />}
                        {p.user?.isDeafened && <Icon icon="fontelico:headphones" width="14" style={{ opacity: 0.5 }} />}
                        {!p.user?.isVideoEnabled && !p.user?.isAudioEnabled && <Icon icon="fa:cloud" width="14" />}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* IRC Users */}
              {ircUsers.size > 0 && <div style={{ marginTop: '12px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IRC / Text Only</div>}
              {/* IRC Users (Humans) */}
              {Array.from(ircUsers.values())
                .filter(u => {
                  const isBot = ['camroomslogbot', 'chatlogbot', 'chanserv'].includes(u.name.toLowerCase());
                  const isMe = u.name === user.name;
                  const isPeer = Array.from(peers.values()).some(p => p.user?.name === u.name);
                  return !isBot && !isMe && !isPeer;
                })
                .map((u) => (
                  <div key={u.name} className="user-item" onClick={(e) => {
                    setSelectedProfileUser(u);
                    setModalPosition({ x: e.clientX, y: e.clientY });
                  }} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img
                        src={u.avatar || `/ api / avatar / ${u.name} `}
                        alt={u.name}
                        className={tubeState?.playing ? 'dancing' : ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                        <span style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px', background: '#333', color: '#888', fontWeight: 'bold' }}>IRC</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '4px', marginTop: '2px', alignItems: 'center' }}>
                        <Icon icon="fa:keyboard-o" width="14" />
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
                .filter(u => ['camroomslogbot', 'chatlogbot', 'chanserv'].includes(u.name.toLowerCase()))
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

                  let icon = 'fa:android';
                  if (role === 'OFFICIAL') icon = 'fa:file-text-o';
                  if (role === 'SERVICE') icon = 'fa:shield';

                  return (
                    <div key={u.name} className="user-item" style={{ background: 'rgba(79, 70, 229, 0.05)', borderColor: 'rgba(79, 70, 229, 0.2)' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px rgba(79, 70, 229, 0.4)' }}>
                        <Icon icon={icon} width="16" color="white" />
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

      <ProfileModal
        user={{ ...user, customStatus }}
        isOpen={showOwnProfile}
        onClose={() => setShowOwnProfile(false)}
        viewingUserRole={user.role} // Pass role for own profile (tho mostly irrelevant)
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
      />

      {/* Admin Modal */}
      {/* Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onlineCount={peers.size + 1}
      />

      {/* Admin Button (Bottom Left, above Settings) */}
      {(user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.role === 'OWNER') && (
        <button
          onClick={() => setIsAdminOpen(true)}
          className="btn icon-btn"
          style={{
            position: 'fixed', bottom: '70px', left: '20px', zIndex: 100,
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          title="Mission Control"
        >
          <Icon icon="fa:shield" width="18" />
        </button>
      )}

      {/* Settings Toggle (Fixed Bottom Left) */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="btn icon-btn"
        style={{
          position: 'fixed', bottom: '20px', left: '20px', zIndex: 100,
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(15, 16, 19, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)', cursor: 'pointer', backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
        title="Settings"
      >
        <Icon icon="fa:cog" width="18" />
      </button>


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
      <ProfileModal
        user={selectedProfileUser}
        isOpen={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        position={modalPosition}
        peerSettings={peerSettings}
        onUpdatePeerSettings={handleUpdatePeerSettings}
        viewingUserRole={user.role} // Pass local user role
      />
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

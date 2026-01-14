"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getCookie, setCookie } from 'cookies-next';
import { Icon } from '@iconify/react';
import { SocketProvider } from "@/lib/socket";
import Background from './Background';
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
import RoomSettings from "@/components/RoomSettings";


function MainApp({ user, setUser, onLeaveRoom }) {
  const roomId = user.roomId || "general";
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
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false); // Admin Modal
  const mobileResizeRef = useRef({ isResizing: false });

  // State initialization with cookie fallback
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = getCookie('sidebarWidth');
    return saved ? parseInt(saved, 10) : 320;
  });

  const [sidebarHeight, setSidebarHeight] = useState(() => {
    const saved = getCookie('sidebarHeight');
    return saved ? parseInt(saved, 10) : 450;
  });

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [isUltraSmall, setIsUltraSmall] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsUltraSmall(window.innerWidth <= 480);

      // Set CSS variable for true viewport height (handles mobile address bar)
      // Use visualViewport if available (more accurate on mobile), fallback to innerHeight
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--true-vh', `${vh}px`);
    };

    if (typeof window !== 'undefined') {
      checkSize();
      window.addEventListener('resize', checkSize);
      // Also listen for visualViewport changes (mobile address bar show/hide)
      window.visualViewport?.addEventListener('resize', checkSize);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkSize);
        window.visualViewport?.removeEventListener('resize', checkSize);
      }
    };
  }, []);

  // Persist sidebar sizes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCookie('sidebarWidth', sidebarWidth, { maxAge: 60 * 60 * 24 * 365 });
      setCookie('sidebarHeight', sidebarHeight, { maxAge: 60 * 60 * 24 * 365 });
    }, 500);
    return () => clearTimeout(timer);
  }, [sidebarWidth, sidebarHeight]);

  // Sanity check on mount (Fix stuck "fullscreen" cookies)
  // And apply 20% default if no cookie exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('sidebarWidth');
      const maxSafeWidth = window.innerWidth * 0.9;

      if (!saved) {
        // User Request: Default to ~20% of screen
        const targetWidth = Math.max(280, window.innerWidth * 0.2);
        setSidebarWidth(targetWidth);
      } else if (sidebarWidth > maxSafeWidth) {
        // Fix broken cookies
        setSidebarWidth(Math.min(sidebarWidth, 500));
      }
    }
  }, []);

  // Fluid Background Animation (Flashlight)
  useEffect(() => {
    console.log("🚀 App Version: Fix-Round-3.25 (Nick Change Fix)");
    let ticking = false;
    const handleBgMove = (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update CSS variables on root for starmap-bg to use
          document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
          document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', handleBgMove);
    return () => window.removeEventListener('mousemove', handleBgMove);
  }, []);

  const [activeTab, setActiveTab] = useState('logs');
  const [isResizing, setIsResizing] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showOwnProfile, setShowOwnProfile] = useState(false);
  const [showStatusInput, setShowStatusInput] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [modalPosition, setModalPosition] = useState(null);
  const [peerSettings, setPeerSettings] = useState({}); // { [userId]: { volume: 1, muted: false, hidden: false } }
  const [mentionCounts, setMentionCounts] = useState({});
  const [chatReactions, setChatReactions] = useState([]);
  const { tubeState, receivedAt, updateTubeState, isOwner: isTubeOwner } = useYouTubeSync(roomId, user);

  // Activity-based UI state (mobile optimization)
  // Tracks last activity timestamp per username: { [username]: timestamp }
  const [userActivity, setUserActivity] = useState({});
  // Computed display states: 'active' | 'semi-active' | 'inactive'
  const [displayStates, setDisplayStates] = useState({});

  // Activity thresholds (in ms)
  const SEMI_ACTIVE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
  const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes



  // HACK: Force Next.js HMR Toast/Portal to be visible and clear of input box
  useEffect(() => {
    const fixToast = () => {
      const portals = document.querySelectorAll('nextjs-portal, [data-nextjs-toast]');
      portals.forEach(el => {
        // Force Host Styles
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('z-index', '2147483647', 'important');
        el.style.setProperty('bottom', '120px', 'important');
        el.style.setProperty('right', '20px', 'important');

        // Force Shadow DOM Content & Inject Styles
        try {
          if (el.shadowRoot) {
            // Inject Animation Styles if missing
            if (!el.shadowRoot.querySelector('#throb-style')) {
              const s = document.createElement('style');
              s.id = 'throb-style';
              s.textContent = `
                    @keyframes global-throb {
                        0% { box-shadow: 0 0 5px #22c55e; }
                        50% { box-shadow: 0 0 20px #22c55e, 0 0 30px rgba(34, 197, 94, 0.6); }
                        100% { box-shadow: 0 0 5px #22c55e; }
                    }
                    [data-nextjs-toast], [data-nextjs-refresh] {
                        animation: global-throb 1.5s ease-in-out infinite !important;
                        border: 1px solid #22c55e !important;
                        border-left: 4px solid #22c55e !important;
                        background: #050505 !important;
                    }
                `;
              el.shadowRoot.appendChild(s);
            }

            const inner = el.shadowRoot.querySelector('[data-nextjs-toast], [data-nextjs-refresh]');
            if (inner) {
              inner.style.setProperty('position', 'fixed', 'important');
              inner.style.setProperty('z-index', '2147483647', 'important');
              inner.style.setProperty('bottom', '120px', 'important');
              inner.style.setProperty('right', '20px', 'important');
            }
          }
        } catch (e) { /* Ignore */ }
      });
    };
    const interval = setInterval(fixToast, 1000);
    fixToast();
    return () => clearInterval(interval);
  }, []);

  const handleUpdatePeerSettings = (userId, newSettings) => {
    setPeerSettings(prev => ({
      ...prev,
      [userId]: { ...prev[userId], ...newSettings }
    }));
  };

  const handleProfileClick = (arg1, arg2, arg3) => {
    let targetUser = null;
    let event = null;

    if (typeof arg1 === 'string') {
      // Called from ChatPanel: (username, userId, avatarUrl)
      const username = arg1;
      const userId = arg2;
      const avatarUrl = arg3;

      // 0. Check if it's ME (The Local User) - Highest Priority
      if (user && username === user.name) {
        targetUser = user;
      }
      // 1. Try to find in active peers (Rich data: role, seed, etc)
      else {
        const peer = Array.from(peers.values()).find(p => p.user?.name === username);
        if (peer?.user) {
          targetUser = peer.user;
        }
        // 2. Try to find in IRC users
        else if (ircUsers.has(username)) {
          targetUser = { ...ircUsers.get(username), role: 'USER' }; // Default IRC users to USER role
        }
        // 3. Fallback (Offline/History)
        else {
          targetUser = {
            name: username,
            id: userId,
            avatar: avatarUrl, // Critical: Use the avatar from the message (has seed)
            role: 'USER', // Default for history
            isGuest: !userId
          };
        }
      }
    } else {
      // Called from VideoGrid/UserList: (userObject, event)
      targetUser = arg1;
      event = arg2;
    }

    event?.stopPropagation();
    setSelectedProfileUser(targetUser);

    if (event?.clientX) {
      setModalPosition({ x: event.clientX, y: event.clientY });
    } else {
      setModalPosition(null);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setShowProfileMenu(false);
    if (showProfileMenu) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showProfileMenu]);

  // Mod: Force Cam Down listener
  useEffect(() => {
    if (!socket) return;

    const handleForceCamDown = ({ banMinutes, reason }) => {
      console.log(`[Mod] Received force-cam-down: ${reason}, ban: ${banMinutes}m`);
      // Stop broadcasting if currently broadcasting
      if (isBroadcasting) {
        stopBroadcast();
        setIsBroadcasting(false);
      }
      // Show notification to user
      if (banMinutes > 0) {
        alert(`Your camera was disabled by a moderator. You cannot re-enable it for ${banMinutes} minutes.`);
      }
    };

    socket.on('force-cam-down', handleForceCamDown);
    return () => socket.off('force-cam-down', handleForceCamDown);
  }, [socket, isBroadcasting, stopBroadcast]);

  // Handle nick change confirmation from server
  useEffect(() => {
    if (!socket) return;

    const handleNickChanged = ({ newNick }) => {
      console.log(`[Nick] Nick changed to: ${newNick}`);
      setUser(prev => ({ ...prev, name: newNick }));
      // Persist to cookie so it survives page refresh (session cache doesn't update immediately)
      setCookie('custom_nick', newNick, { maxAge: 60 * 60 * 24 * 365, path: '/' });
    };

    socket.on('nick-changed', handleNickChanged);
    return () => socket.off('nick-changed', handleNickChanged);
  }, [socket]);

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      try {
        stopBroadcast();
      } catch (err) {
        console.error("Error stopping broadcast:", err);
      } finally {
        setIsBroadcasting(false);
      }
      return;
    }

    // BEST PRACTICE: Check permission state FIRST using Permissions API
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const micPermission = await navigator.permissions.query({ name: 'microphone' });

      console.log('[Permissions] Camera:', cameraPermission.state, 'Mic:', micPermission.state);

      // If either was denied (not just "prompt"), user needs to manually reset in browser
      if (cameraPermission.state === 'denied' || micPermission.state === 'denied') {
        alert(
          'Camera/Microphone access was previously denied.\n\n' +
          'To fix this:\n' +
          '1. Tap the lock icon (🔒) in the address bar\n' +
          '2. Find "Camera" and "Microphone"\n' +
          '3. Change them to "Allow"\n' +
          '4. Refresh the page'
        );
        return;
      }
    } catch (permErr) {
      // Permissions API not supported on this browser, continue anyway
      console.warn('[Permissions] API not supported, continuing...');
    }

    // Now request camera - should show prompt if state was "prompt"
    let stream;
    try {
      console.log('[Camera] Requesting from click handler...');
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[Camera] Got stream!');
    } catch (err) {
      console.error('[Camera] Permission error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        alert(
          'Camera access denied.\n\n' +
          'Please tap the lock icon (🔒) in the address bar, ' +
          'set Camera and Microphone to "Allow", then refresh the page.'
        );
      } else {
        alert('Camera Error: ' + (err.message || 'Unknown error'));
      }
      return;
    }

    try {
      await startBroadcast(stream);
      setIsBroadcasting(true);
    } catch (err) {
      console.error("Error starting broadcast:", err);
      stream?.getTracks().forEach(t => t.stop());
      setIsBroadcasting(false);
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

  // Redundant background mouse tracking removed (handled by optimized listener above)


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

      // Update activity tracking (user is active if they sent a message)
      setUserActivity(prev => ({
        ...prev,
        [author]: Date.now()
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
  const handleMobileResizeStart = (e) => {
    mobileResizeRef.current.isResizing = true;
    setIsResizing(true);
    // Prevent default to avoid scrolling/selection - Critical for mobile drag
    if (e.cancelable) e.preventDefault();
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;

    // Prevent default scrolling behavior on mobile while resizing
    if (e.cancelable) e.preventDefault();

    // Get the correct coordinate depending on touch vs mouse
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;

    console.log('[ResizeDebug] Move:', { isMobile, clientY, innerHeight: window.innerHeight });

    if (isMobile) {
      const newHeight = window.innerHeight - clientY;
      const maxHeight = window.innerHeight * 0.9; // Slightly more range
      const minHeight = 110; // Even tighter for true economy
      const clamped = Math.max(minHeight, Math.min(maxHeight, newHeight));
      console.log('[ResizeDebug] Setting Height:', clamped);
      setSidebarHeight(clamped);
    } else {
      const newWidth = window.innerWidth - clientX;
      const maxWidth = window.innerWidth * 0.8;
      const constrained = Math.max(280, Math.min(maxWidth, newWidth));
      setSidebarWidth(constrained);
    }
  }, [isResizing, isMobile]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('resizing');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      return () => {
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Activity-based display state calculation (mobile optimization)
  // Runs every 30s to recompute which users should be full/collapsed/hidden
  useEffect(() => {
    if (!isMobile) return; // Only active on mobile

    const computeDisplayStates = () => {
      const now = Date.now();
      const newStates = {};

      // Get all users: peers + local user
      const allUsers = [...peers.values().map(p => p.user?.name), user?.name].filter(Boolean);

      allUsers.forEach(username => {
        const lastActivity = userActivity[username] || 0;
        const timeSinceActivity = now - lastActivity;

        // Check if user has video enabled (always active if streaming)
        const peerData = [...peers.values()].find(p => p.user?.name === username);
        const hasVideo = peerData?.user?.isVideoEnabled || (username === user?.name && isVideoEnabled);
        const hasAudio = peerData?.user?.isAudioEnabled || (username === user?.name && isAudioEnabled);

        // Users with video/audio are always active
        if (hasVideo || hasAudio) {
          newStates[username] = 'active';
        } else if (timeSinceActivity < SEMI_ACTIVE_TIMEOUT) {
          newStates[username] = 'active';
        } else if (timeSinceActivity < INACTIVE_TIMEOUT) {
          newStates[username] = 'semi-active';
        } else {
          newStates[username] = 'inactive';
        }
      });

      setDisplayStates(newStates);
    };

    // Initial computation
    computeDisplayStates();

    // Recompute every 30 seconds
    const interval = setInterval(computeDisplayStates, 30000);
    return () => clearInterval(interval);
  }, [isMobile, peers, user, userActivity, isVideoEnabled, isAudioEnabled, SEMI_ACTIVE_TIMEOUT, INACTIVE_TIMEOUT]);


  return (
    <div
      className={`app ${isBuilding ? 'building-mode' : ''} `}
      style={{
        '--dynamic-sidebar-w': `${sidebarWidth}px`,
        '--dynamic-sidebar-h': `${sidebarHeight}px`
      }}
    >
      <Background />
      {/* Background Layer (Explicit) */}


      {/* Fixed Header */}
      <header className="app-header fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 backdrop-blur-lg backdrop-brightness-125 bg-white/5 border-b border-white/10 shadow-lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Logo / Icon - Removed */}
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
            <img
              src="https://i.imgur.com/MfbxoHW.gif"
              alt="gem"
              onClick={onLeaveRoom}
              style={{ height: '20px', marginRight: '4px', cursor: 'pointer' }}
              title="Return to Browser"
            />
            <button
              onClick={onLeaveRoom}
              className="text-btn"
              style={{ color: '#888', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
            >
              chat
            </button>
            <span style={{ color: '#444' }}>/</span>
            <span style={{ color: '#E2E8F0' }}>{user.roomName || roomId}</span>
            <button
              className="text-btn"
              onClick={() => setIsRoomSettingsOpen(true)}
              title="Room Settings"
              style={{ color: '#666', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: '8px', opacity: 0.7 }}
            >
              <Icon icon="fa:cog" width="12" />
            </button>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Avatar Aquarium - Moved to header if room permits, otherwise displaced to video grid area */}
          {!isMobile && (

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
                    const base = u.avatar || `/api/avatar/${u.name}`;
                    // Only animate if it's our internal avatar API
                    let avatarUrl = base;
                    if (isUserTyping && base.includes('/api/avatar')) {
                      const hasQuery = base.includes('?');
                      avatarUrl = `${base}${hasQuery ? '&' : '?'}expr=typing`;
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
          )}

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
            style={{ padding: isUltraSmall ? '6px' : '6px 12px', fontSize: '12px', height: '32px', minWidth: isUltraSmall ? '32px' : '80px' }}
            onClick={handleToggleBroadcast}
            title={isBroadcasting ? 'Stream Off' : 'Stream On'}
          >
            {isUltraSmall ? (
              <Icon icon={isBroadcasting ? "fa:stop" : "fa:play"} width="14" />
            ) : (isBroadcasting ? 'Stream Off' : 'Stream')}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Connection Status */}
          <div className={`status - dot ${isConnected ? 'connected' : 'disconnected'} `} title={isConnected ? 'Connected' : 'Disconnected'} />

          {/* Mobile Navigation Header (Relocated & Crowded) */}
          {isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 6px',
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              borderRadius: '20px',
              height: '32px',
              border: '1px solid var(--glass-border)'
            }}>
              {/* Chat Tab Icon */}
              <button
                onClick={() => setActiveTab('logs')}
                style={{
                  background: activeTab === 'logs' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: activeTab === 'logs' ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <Icon icon="mdi:chat" width="16" />
              </button>

              {/* Divider */}
              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />

              {/* Crowded Avatar List */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                maxWidth: '120px',
                overflowX: 'auto',
                paddingRight: '6px',
                scrollbarWidth: 'none', // Hide scrollbar for cleaner look
                msOverflowStyle: 'none'
              }}>
                {(() => {
                  const uniqueMap = new Map();
                  // Note: We intentionally DO NOT add 'user' (self) to this map anymore
                  // if (user && user.name) uniqueMap.set(user.name, user); 

                  peers.forEach(p => { if (p.user && p.user.name && !uniqueMap.has(p.user.name)) uniqueMap.set(p.user.name, p.user); });
                  ircUsers.forEach(u => { if (u && u.name && !uniqueMap.has(u.name)) uniqueMap.set(u.name, u); });

                  return Array.from(uniqueMap.values())
                    .filter(u => {
                      // Filter bots AND current user
                      if (['camroomslogbot', 'chatlogbot'].includes(u.name.toLowerCase())) return false;
                      if (u.name === user.name) return false;
                      return true;
                    })
                    .map((u, i) => (
                      <div
                        key={u.name + i}
                        onClick={() => setActiveTab('services')}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          // Use box-shadow for the 'border' to avoid box-sizing issues
                          boxShadow: '0 0 0 2px #1e1f22', // Dark background color wrapper
                          marginLeft: i === 0 ? '0' : '-10px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          zIndex: 10 + i,
                          position: 'relative',
                          overflow: 'hidden',
                          background: '#1e1f22' // Fallback bg
                        }}
                      >
                        <img
                          src={u.avatar || `/api/avatar/${u.name}`}
                          alt={u.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block'
                          }}
                        />
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

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
                <div
                  style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => { setShowProfileMenu(false); setShowStatusInput(true); }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{user.globalName || user.name}</div>
                  <div style={{ fontSize: '11px', color: '#3ba55d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#3ba55d', borderRadius: '50%', display: 'inline-block' }}></span>
                    {customStatus || 'Online'}
                    <Icon icon="fa:pencil" width="10" style={{ marginLeft: '6px', opacity: 0.5 }} />
                  </div>
                </div>
                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowOwnProfile(true); }}>
                  <Icon icon="fa:user" width="16" /> View Profile
                </button>

                <button className="menu-item" onClick={() => { setShowProfileMenu(false); setShowSettingsModal(true); }}>
                  <Icon icon="fa:cog" width="16" /> Settings
                </button>

                {/* Mission Control (Relocated from absolute bottom-left) */}
                {(user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.role === 'OWNER') && (
                  <button className="menu-item" style={{ color: 'var(--accent-primary)' }} onClick={() => { setShowProfileMenu(false); setIsAdminOpen(true); }}>
                    <Icon icon="fa:shield" width="16" /> Mission Control
                  </button>
                )}

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
            style={{ position: 'relative', zIndex: 10 }}
            isMobile={isMobile}
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
            displayStates={displayStates}
            chatBubbles={chatBubbles}
          />
        </div>

        {/* Mobile Dedicated Resizer Bar - Standalone in flex flow to avoid clipping */}
        {isMobile && (
          <div
            className="mobile-drag-bar"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startY = e.touches[0].clientY;
              const startHeight = sidebarHeight;

              const onMove = (moveEvent) => {
                const currentY = moveEvent.touches[0].clientY;
                const delta = startY - currentY;
                const newHeight = startHeight + delta;
                // Calculate available space: viewport - header(40) - minVideoArea(100) - dragBar(20)
                const viewportHeight = window.visualViewport?.height || window.innerHeight;
                const maxSidebarHeight = viewportHeight - 40 - 100 - 20;
                const clamped = Math.max(160, Math.min(maxSidebarHeight, newHeight));
                setSidebarHeight(clamped);
              };

              const onEnd = () => {
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                setIsResizing(false);
              };

              setIsResizing(true);
              document.addEventListener('touchmove', onMove, { passive: false });
              document.addEventListener('touchend', onEnd);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = sidebarHeight;

              const onMove = (moveEvent) => {
                const delta = startY - moveEvent.clientY;
                const newHeight = startHeight + delta;
                const clamped = Math.max(160, Math.min(window.innerHeight - 80, newHeight));
                setSidebarHeight(clamped);
              };

              const onEnd = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onEnd);
                setIsResizing(false);
              };

              setIsResizing(true);
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onEnd);
            }}
            style={{
              height: '4px',
              padding: '16px 0',
              margin: '-16px 0',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'row-resize',
              touchAction: 'none',
              background: 'transparent',
              position: 'relative'
            }}
          >
            <div style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: isResizing ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.4)',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              transition: 'background 0.2s, transform 0.2s',
              transform: isResizing ? 'scaleY(1.5)' : 'none'
            }} />
          </div>
        )}

        {/* Floating Right Sidebar (Chat) */}
        <aside
          className="floating-sidebar backdrop-blur-lg backdrop-brightness-125 bg-white/5 border-l border-white/10 shadow-2xl"
          style={{
            height: isMobile ? `${sidebarHeight}px` : '100%',
            maxHeight: isMobile ? `calc(100dvh - 40px - 20px)` : undefined, // Cap at viewport minus header minus drag bar
            width: isMobile ? '100%' : `${sidebarWidth}px`,
            overflow: isMobile ? 'hidden' : undefined, // Ensure content clips on mobile
          }}
        >
          {/* Desktop Resize Handle */}
          {!isMobile && (
            <div
              className={`drag-handle ${isBuilding ? 'active-pulse' : ''} `}
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                left: '-8px', // Overlap correctly
                top: 0,
                bottom: 0,
                width: '16px', // Much easier to grab
                cursor: 'col-resize',
                zIndex: 100, // Ensure it's on top
                touchAction: 'none',
                background: 'transparent' // Invisible hit area
              }}
            />
          )}

          {/* Sidebar Tabs - Hidden on Mobile (moved to ChatPanel bottom row) */}
          {!isMobile && (
            <div className="side-header" style={{
              padding: isMobile ? '0 8px' : '0 16px',
              gap: '8px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              minHeight: isMobile ? '30px' : '48px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                <button
                  className={`btn ${activeTab === 'logs' ? 'primary' : ''} `}
                  style={{ flex: 1, fontSize: '11px', padding: '4px', border: 'none', background: activeTab === 'logs' ? 'rgba(255,255,255,0.1)' : 'transparent', height: '28px' }}
                  onClick={() => setActiveTab('logs')}
                >
                  Chat
                </button>
                <button
                  className={`btn ${activeTab === 'services' ? 'primary' : ''} `}
                  style={{ flex: 1, fontSize: '11px', padding: '4px', border: 'none', background: activeTab === 'services' ? 'rgba(255,255,255,0.1)' : 'transparent', height: '28px' }}
                  onClick={() => setActiveTab('services')}
                >
                  Users ({(() => {
                    const webUserNames = new Set([user.name, ...Array.from(peers.values()).map(p => p.user?.name).filter(Boolean)]);
                    const uniqueIrcCount = Array.from(ircUsers.values()).filter(u => !webUserNames.has(u.name)).length;
                    return webUserNames.size + uniqueIrcCount;
                  })()})
                </button>
              </div>
            </div>
          )}

          <div className="side-content" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Chat Panel - Always mounted to preserve state */}
            <div style={{ flex: 1, display: activeTab === 'logs' ? 'flex' : 'none', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <ChatPanel
                roomId={roomId}
                user={user}
                currentUser={user} // Pass local user state for self-lookup
                users={Array.from(peers.values())}
                ircUsers={Array.from(ircUsers.values())}
                onUserClick={handleProfileClick}
                sendToIRC={sendToIRC}
                isMobile={isMobile}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                peers={peers}
                {...chat}
              />
            </div>

            {/* User List (Services) - Always mounted for consistency */}
            <div style={{ padding: '16px', display: activeTab === 'services' ? 'flex' : 'none', flexDirection: 'column', gap: '8px' }}>
              {/* Local User */}
              <div className="user-item">
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#242424', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img
                    src={user.avatar || `/api/avatar/${user.name}`}
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
                        src={p.user?.avatar || `/api/avatar/${p.user?.name || 'Guest'}`}
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
                        src={u.avatar || `/api/avatar/${u.name}`}
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
      {
        error && (
          <div style={{
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#F87171', color: 'white', padding: '10px 20px', borderRadius: '8px',
            fontWeight: '500', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999
          }}>
            {error}
          </div>
        )
      }

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



      {/* Status Input Dialog */}
      {
        showStatusInput && (
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
        )
      }
      <ProfileModal
        user={selectedProfileUser}
        isOpen={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        position={modalPosition}
        peerSettings={peerSettings}
        onUpdatePeerSettings={handleUpdatePeerSettings}
        currentUser={user} // Pass local user state for role checks (Guest Admin actions)
        viewingUserRole={user.role} // Fallback
      />

      <RoomSettings
        roomId={roomId}
        isOpen={isRoomSettingsOpen}
        onClose={() => setIsRoomSettingsOpen(false)}
      />

      {
        showSettingsModal && (
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            user={user}
            onSaveSuccess={(newData) => {
              setUser(prev => ({ ...prev, ...newData }));
            }}
          />
        )
      }
    </div >
  );
}

export default function ClientApp({ initialRoom }) {
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
    document.cookie = 'custom_nick=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // OPTIONAL: Sign out of NextAuth?
    // User Feedback: Keep session persistent so they can switch rooms easily.
    // To logout completely, use the logout button in EntryScreen.
    /*
    try {
      const {signOut} = await import('next-auth/react');
      await signOut({redirect: false });
    } catch (e) { }
      */

    // Reset to entry screen
    setUser(null);
    setIsRegistered(false);
  };

  return (
    <SocketProvider user={user}>
      {!isRegistered ? (
        <EntryScreen onJoin={handleJoin} initialRoom={initialRoom} />
      ) : (
        <MainApp user={user} setUser={setUser} onLeaveRoom={handleLeave} />
      )}
    </SocketProvider>
  );
}

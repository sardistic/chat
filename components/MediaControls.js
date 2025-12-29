"use client";

import { Icon } from '@iconify/react';

export default function MediaControls({
    isAudioEnabled,
    isVideoEnabled,
    onToggleAudio,
    onToggleVideo,
    onLeaveRoom,
    onOpenSettings
}) {
    return (
        <div className="media-controls">
            <div className="controls-inner">
                <button
                    className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
                    onClick={onToggleAudio}
                    title={isAudioEnabled ? 'Mute' : 'Unmute'}
                >
                    <span className="icon">{isAudioEnabled ? <Icon icon="fa:microphone" width="20" /> : <Icon icon="fa:microphone-slash" width="20" />}</span>
                    <span className="label">{isAudioEnabled ? 'Mute' : 'Unmuted'}</span>
                </button>

                <button
                    className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                    onClick={onToggleVideo}
                    title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
                >
                    <span className="icon">{isVideoEnabled ? <Icon icon="fa:video-camera" width="20" /> : <Icon icon="fa:video-camera" width="20" style={{ opacity: 0.5 }} />}</span>
                    <span className="label">{isVideoEnabled ? 'Video' : 'No Video'}</span>
                </button>

                <button
                    className="control-btn"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <span className="icon"><Icon icon="fa:cog" width="20" /></span>
                    <span className="label">Settings</span>
                </button>

                <button
                    className="control-btn danger"
                    onClick={onLeaveRoom}
                    title="Leave Room"
                >
                    <span className="icon"><Icon icon="fa:phone" width="20" /></span>
                    <span className="label">Leave</span>
                </button>
            </div>
        </div>
    );
}

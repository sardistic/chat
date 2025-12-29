"use client";

import {
    IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff,
    IconSettings, IconPhoneOff
} from '@tabler/icons-react';

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
                    <span className="icon">{isAudioEnabled ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} />}</span>
                    <span className="label">{isAudioEnabled ? 'Mute' : 'Unmuted'}</span>
                </button>

                <button
                    className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                    onClick={onToggleVideo}
                    title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
                >
                    <span className="icon">{isVideoEnabled ? <IconVideo size={20} /> : <IconVideoOff size={20} />}</span>
                    <span className="label">{isVideoEnabled ? 'Video' : 'No Video'}</span>
                </button>

                <button
                    className="control-btn"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <span className="icon"><IconSettings size={20} /></span>
                    <span className="label">Settings</span>
                </button>

                <button
                    className="control-btn danger"
                    onClick={onLeaveRoom}
                    title="Leave Room"
                >
                    <span className="icon"><IconPhoneOff size={20} /></span>
                    <span className="label">Leave</span>
                </button>
            </div>
        </div>
    );
}

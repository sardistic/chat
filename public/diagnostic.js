// Paste this into the browser console to diagnose the issue

console.log('=== SOCKET DIAGNOSTIC ===');

// Check if socket exists
const socketContext = window.__NEXT_DATA__?.props?.pageProps;
console.log('1. Checking socket connection...');

// Listen for all socket events
if (window.io) {
    console.log('✅ Socket.io client loaded');
} else {
    console.log('❌ Socket.io client NOT loaded');
}

// Add listeners for all events
const eventNames = ['user-joined', 'existing-users', 'signal', 'user-left', 'chat-message'];

eventNames.forEach(eventName => {
    console.log(`📡 Setting up listener for: ${eventName}`);
});

console.log('\n2. Current state:');
console.log('   - Check if you see "✅ Socket connected" message above');
console.log('   - Check if you see "🚀 Joining room" message');
console.log('   - Check if you see "📋 Existing users" or "👋 User joined" messages');

console.log('\n3. Open a second tab and join the room');
console.log('   - You should see "👋 User [name] joined" in THIS tab');
console.log('   - The second tab should see "📋 Existing users in room"');

console.log('\n=== END DIAGNOSTIC ===');

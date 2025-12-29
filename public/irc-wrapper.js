// Wrapper to expose irc-framework as window.irc
// The bundle is a self-executing function that exports via module.exports
// We need to create a fake module environment for it

(function () {
    var module = { exports: {} };
    var exports = module.exports;

    // Load and execute the original bundle inline
    // Since the bundle uses webpack's IIFE pattern, we'll inject our module shim
})();

// Actually, let's just use the fact that the bundle sets up its own global
// Check what's available after load
console.log('[IRC Wrapper] Loading irc-framework...');

// The irc-framework browser bundle should expose Client on its exports
// We'll use a different approach - load via dynamic import in the hook


const http = require('http');

const sendWebhook = (type, status = 'SUCCESS', commitMsg = 'Test Commit') => {
    const data = JSON.stringify({
        type,
        status,
        project: { name: 'Chat App' },
        deployment: {
            id: 'dep-' + Date.now(),
            meta: {
                commit: {
                    message: commitMsg,
                    author: { name: 'TestUser' }
                }
            }
        }
    });

    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/webhooks/deploy?secret=12345', // Assuming typical port/secret, will default if not set
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }, (res) => {
        console.log(`${type}: StatusCode ${res.statusCode}`);
        res.on('data', d => process.stdout.write(d));
    });

    req.on('error', (error) => {
        console.error(error);
    });

    req.write(data);
    req.end();
};

console.log('--- Simulating Deployment ---');
// 1. Deploy Start
console.log('Sending DEPLOY...');
sendWebhook('Deploy', 'BUILDING');

// 2. Wait 5s then Success
setTimeout(() => {
    console.log('\nSending SUCCESS...');
    sendWebhook('Deploy', 'SUCCESS');
}, 5000);

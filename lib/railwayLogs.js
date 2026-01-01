/**
 * Railway Build Log Streaming
 * Connects to Railway's GraphQL API to stream build logs in real-time
 */

const { createClient } = require('graphql-ws');
const WebSocket = require('ws');

const RAILWAY_API_URL = 'wss://backboard.railway.com/graphql/v2';
const RAILWAY_HTTP_URL = 'https://backboard.railway.com/graphql/v2';

class RailwayBuildStream {
    constructor(apiToken, onLog, onComplete, onError) {
        this.apiToken = apiToken;
        this.onLog = onLog || (() => { });
        this.onComplete = onComplete || (() => { });
        this.onError = onError || console.error;
        this.client = null;
        this.unsubscribe = null;
    }

    async connect() {
        if (!this.apiToken) {
            console.warn('[Railway] No API token configured, build logs will not stream');
            return false;
        }

        try {
            this.client = createClient({
                url: RAILWAY_API_URL,
                webSocketImpl: WebSocket,
                connectionParams: {
                    authorization: `Bearer ${this.apiToken}`
                },
                on: {
                    connected: () => console.log('[Railway] WebSocket connected'),
                    closed: () => console.log('[Railway] WebSocket closed'),
                    error: (err) => console.error('[Railway] WebSocket error:', err)
                }
            });
            return true;
        } catch (err) {
            this.onError(err);
            return false;
        }
    }

    /**
     * Subscribe to build logs for a specific deployment
     * @param {string} deploymentId - The Railway deployment ID
     */
    subscribeToBuildLogs(deploymentId) {
        if (!this.client) {
            console.warn('[Railway] Client not connected');
            return;
        }

        console.log(`[Railway] Subscribing to build logs for deployment: ${deploymentId}`);

        // GraphQL subscription for build logs
        const subscription = `
      subscription BuildLogs($deploymentId: String!) {
        buildLogs(deploymentId: $deploymentId) {
          message
          severity
        }
      }
    `;

        this.unsubscribe = this.client.subscribe(
            {
                query: subscription,
                variables: { deploymentId }
            },
            {
                next: (data) => {
                    if (data.data?.buildLogs) {
                        const log = data.data.buildLogs;
                        this.onLog(log.message, log.severity);
                    }
                },
                error: (err) => {
                    console.error('[Railway] Subscription error:', err);
                    this.onError(err);
                },
                complete: () => {
                    console.log('[Railway] Build logs subscription completed');
                    this.onComplete();
                }
            }
        );
    }

    /**
     * Subscribe to deploy logs for a specific deployment
     * @param {string} deploymentId - The Railway deployment ID
     */
    subscribeToDeployLogs(deploymentId) {
        if (!this.client) {
            console.warn('[Railway] Client not connected');
            return;
        }

        console.log(`[Railway] Subscribing to deploy logs for deployment: ${deploymentId}`);

        const subscription = `
      subscription DeployLogs($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId) {
          message
          severity
          timestamp
        }
      }
    `;

        this.client.subscribe(
            {
                query: subscription,
                variables: { deploymentId }
            },
            {
                next: (data) => {
                    if (data.data?.deploymentLogs) {
                        const log = data.data.deploymentLogs;
                        this.onLog(log.message, log.severity, 'deploy');
                    }
                },
                error: (err) => {
                    console.error('[Railway] Deploy logs subscription error:', err);
                },
                complete: () => {
                    console.log('[Railway] Deploy logs subscription completed');
                }
            }
        );
    }

    /**
     * Fetch build logs via HTTP (for past logs or one-time fetch)
     */
    async fetchBuildLogs(deploymentId) {
        if (!this.apiToken) return [];

        try {
            const response = await fetch(RAILWAY_HTTP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    query: `
            query BuildLogs($deploymentId: String!) {
              buildLogs(deploymentId: $deploymentId) {
                message
                severity
              }
            }
          `,
                    variables: { deploymentId }
                })
            });

            const result = await response.json();
            return result.data?.buildLogs || [];
        } catch (err) {
            console.error('[Railway] Failed to fetch build logs:', err);
            return [];
        }
    }

    disconnect() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.client) {
            this.client.dispose();
            this.client = null;
        }
    }
}

module.exports = { RailwayBuildStream };

# Deploying Janus Gateway on Google Cloud Platform (GCP)

This guide helps you set up a **Janus WebRTC Gateway** on your GCP instance to support scalable video conferencing and mobile connectivity.

## Prerequisites
- A GCP Compute Engine instance (e.g., e2-medium or better).
- Ubuntu 20.04/22.04 LTS (Recommended).
- SSH Access.

## Step 1: Firewall Rules (GCP Console)
WebRTC requires specific ports to be open for UDP traffic.

1. Go to **VPC Network** > **Firewall**.
2. Create a new Firewall Rule:
   - **Name:** `allow-janus-webrtc`
   - **Targets:** All instances in the network (or specific tag).
   - **Source IP ranges:** `0.0.0.0/0`
   - **Protocols and ports:**
     - `tcp: 8088` (Janus HTTP API)
     - `tcp: 8188` (Janus WebSocket)
     - `udp: 10000-60000` (RTP Media traffic)
     - `tcp: 80, 443` (Web/HTTPS)

## Step 2: Install Docker
Run these commands on your GCP instance:

```bash
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
```

## Step 3: Run Janus Gateway (Docker)
We will use the official Janus image or a popular pre-configured one.

```bash
# Run Janus in "host" network mode so it can manage UDP ports directly
docker run -d \
  --name janus \
  --net=host \
  --restart=always \
  canyan/janus-gateway
```

### Verification
Check if it's running:
```bash
docker logs janus
```
You should see: `Janus WebRTC Gateway ... initialized!`

## Step 4: Configuring Public IP (NAT)
Janus needs to know it's behind a NAT (GCP uses 1-to-1 NAT).
You must pass your **Public IP** to Janus.

1. **Find your GCP Public IP** (External IP).
2. Stop the container: `docker stop janus && docker rm janus`
3. Run with NAT configuration:

```bash
docker run -d \
  --name janus \
  --net=host \
  --restart=always \
  -e "NAT_1_1_MAPPING=<YOUR_PUBLIC_IP>" \
  canyan/janus-gateway
```
*Note: Replace `<YOUR_PUBLIC_IP>` with your actual External IP address.*

## Step 5: Testing Connection
Your Janus server should now be accessible at:
- **HTTP:** `http://<YOUR_PUBLIC_IP>:8088/janus`
- **WebSocket:** `ws://<YOUR_PUBLIC_IP>:8188/`

You can verify the connection using the [Janus Echo Test Demo](https://janus.conf.meetecho.com/echotest.html) by changing the server URL in the demo settings (if available) or by using `curl`:

```bash
curl http://<YOUR_PUBLIC_IP>:8088/janus/info
```
It should return a JSON object with Janus version info.

## Step 6: Client Integration
Once this server is running, the React application needs to be updated to:
1. Remove `simple-peer`.
2. Install `janus-gateway` npm package.
3. Connect to `ws://<YOUR_PUBLIC_IP>:8188/`.
4. Create a "Video Room" handle.

## Troubleshooting Mobile (Cell Networks)
If mobile users still can't connect, you almost certainly need a **TURN Server**.
You can install **Coturn** on the same GCP instance:

```bash
docker run -d --network=host --name=coturn \
 coturn/coturn \
 -n \
 --log-file=stdout \
 --min-port=49152 \
 --max-port=65535 \
 --realm=<YOUR_DOMAIN_OR_IP> \
 --listening-port=3478 \
 --custom-listen=<YOUR_INTERNAL_IP> \
 --external-ip=<YOUR_PUBLIC_IP> \
 --user=myuser:mypassword \
 --lt-cred-mech
```
Then add this TURN server to your client config.

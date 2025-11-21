# Elite Edge Node Manager

A lightweight Node Manager service for managing Theta Edge Node containers on servers. This service provides a REST API for starting/stopping nodes, creating new ones, querying status, and managing keystores.

## Features

- **Container Management**: Start, stop, and manage Edge Node containers
- **Node Creation**: Create new nodes with auto-generated or custom keystores
- **Status Queries**: Get detailed node status including RPC information
- **Keystore Management**: Download and upload keystore files
- **API Key Authentication**: Secure API access with API key
- **Port Auto-assignment**: Automatic port management starting from base port

## Architecture

Each server runs its own Local Node Manager instance. This design:
- Avoids SSH management
- Reduces latency to Docker socket
- Simplifies permissions
- Eliminates single points of failure

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd een-manager
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

## Configuration

Create a `.env` file with the following variables:

- `API_KEY` (required): API key for authentication
- `PASSWORD` (required): Password for the edge nodes (used for all nodes)
- `PORT` (optional): Server port (default: 3000)
- `DATA_DIR` (optional): Base directory for node data (default: `/mnt/edgenodes`)
- `BASE_PORT` (optional): Starting port for nodes (default: 17888)
- `DOCKER_IMAGE` (optional): Docker image (default: `thetalabsorg/edgelauncher_mainnet:v1.0.0`)

## Usage

### Start the server:
```bash
npm start
```

### Development mode:
```bash
npm run dev
```

## Nginx Reverse Proxy Setup

To expose the API externally using nginx, follow these steps:

### 1. Install Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. Create Nginx Configuration

Create a configuration file for the Node Manager service:

```bash
sudo nano /etc/nginx/sites-available/een-manager
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain;

    # Proxy all requests to the Node Manager service
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for long-running operations
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Note:** Replace `your-server-ip-or-domain` with your server's IP address or domain name, and ensure the `proxy_pass` port matches your Node Manager `PORT` configuration (default: 3000).

### 3. Enable the Configuration

```bash
# Create symbolic link (Ubuntu/Debian)
sudo ln -s /etc/nginx/sites-available/een-manager /etc/nginx/sites-enabled/

# Or for CentOS/RHEL, add the configuration to /etc/nginx/conf.d/een-manager.conf
```

### 4. Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 5. Configure Firewall

Allow HTTP/HTTPS traffic through your firewall:

```bash
# UFW (Ubuntu)
sudo ufw allow 'Nginx Full'

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 6. Access the API

Once configured, you can access the API externally:

- `http://your-server-ip/nodes` - List all nodes
- `http://your-server-ip/nodes/:id/status` - Get node status
- `http://your-server-ip/health` - Health check

### SSL/HTTPS Setup (Recommended)

For production, set up SSL using Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian
sudo yum install certbot python3-certbot-nginx  # CentOS/RHEL

# Obtain certificate
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically update your nginx configuration to use HTTPS.

## API Endpoints

All endpoints require the `x-api-key` header with your API key.

### GET /health
Health check endpoint (no authentication required).

### GET /nodes
List all nodes with their status.

**Response:**
```json
{
  "nodes": [
    {
      "name": "node-001",
      "port": 17888,
      "status": "running",
      "containerId": "...",
      "keystorePath": "edgecore/key/encrypted",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /nodes/:id/status
Get detailed status for a specific node.

**Response:**
```json
{
  "container": {
    "id": "...",
    "name": "edge-node-001",
    "status": "running",
    "ports": {
      "17888": "17888"
    }
  },
  "rpc": {
    "status": {...},
    "summary": {...},
    "address": "0x..."
  },
  "metadata": {...}
}
```

### GET /nodes/:id/keystore
Download the keystore file for a node (returns raw file content).

### POST /nodes/new
Create a new node with auto-generated keystore.

**Request:**
```json
{
  "name": "node-003"
}
```

### POST /nodes/new-with-keystore
Create a new node with a custom keystore.

**Request:**
```json
{
  "name": "node-004",
  "keystore": {
    "address": "0x...",
    "crypto": {
      "cipher": "...",
      "ciphertext": "...",
      "cipherparams": {...},
      "kdf": "...",
      "kdfparams": {...},
      "mac": "..."
    },
    "id": "...",
    "version": 3
  }
}
```

**Note:** The keystore should be provided as a JSON object (same format as stored by the edgenode).

### POST /nodes/:id/start
Start a stopped node.

### POST /nodes/:id/stop
Stop a running node.

## Node Data Structure

Nodes are stored in the data directory with the following structure:

```
/mnt/edgenodes/
├── nodes.json              # Node metadata
├── node-001/
│   └── edgecore/
│       └── key/
│           └── encrypted   # Keystore file
├── node-002/
│   └── edgecore/
│       └── key/
│           └── encrypted
└── ...
```

## Docker Requirements

- Docker must be installed and running
- The service must have permission to access the Docker socket
- The Docker image `thetalabsorg/edgelauncher_mainnet:v1.0.0` must be available

## Port Management

Ports are auto-assigned starting from `BASE_PORT` (default: 17888). Each new node gets the next available port. Port assignments are stored in the metadata file.

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized (invalid/missing API key)
- `404`: Not Found
- `500`: Internal Server Error

## Security

- All API endpoints (except `/health`) require API key authentication
- Keystore files are stored securely in isolated directories
- Container operations are scoped to managed containers only

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## License

MIT


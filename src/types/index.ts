export interface NodeMetadata {
  name: string;
  port: number;
  containerId?: string;
  containerName?: string;
  status: 'running' | 'stopped' | 'unknown';
  keystorePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodesMetadata {
  nodes: NodeMetadata[];
  nextPort: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: { [key: string]: Array<{ HostPort: string }> };
}

export interface NodeStatus {
  container: {
    id: string;
    name: string;
    status: string;
    ports: { [key: string]: string };
  };
  rpc: {
    status?: any;
    summary?: any;
    address?: string;
  };
  metadata: NodeMetadata;
}

export interface CreateNodeRequest {
  name: string;
}

export interface CreateNodeWithKeystoreRequest {
  name: string;
  keystore: object; // JSON keystore object
}


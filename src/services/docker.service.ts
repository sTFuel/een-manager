import Docker from 'dockerode';
import { ContainerInfo } from '../types';
import { config, getNodeDataDir } from '../config';

const docker = new Docker();

const CONTAINER_NAME_PREFIX = 'edge-';

export function getContainerName(nodeName: string): string {
  return `${CONTAINER_NAME_PREFIX}${nodeName}`;
}

export async function listContainers(): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({ all: true });
    
    return containers
      .filter((container: Docker.ContainerInfo) => 
        container.Image === config.dockerImage ||
        container.Names?.some((name: string) => name.includes(CONTAINER_NAME_PREFIX))
      )
      .map((container: Docker.ContainerInfo) => ({
        id: container.Id,
        name: container.Names?.[0]?.replace('/', '') || '',
        status: container.Status || 'unknown',
        image: container.Image,
        ports: container.Ports.reduce((acc: { [key: string]: Array<{ HostPort: string }> }, port: Docker.Port) => {
          if (port.PrivatePort === 17888 && port.PublicPort) {
            acc['17888'] = [{ HostPort: port.PublicPort.toString() }];
          }
          return acc;
        }, {} as { [key: string]: Array<{ HostPort: string }> }),
      }));
  } catch (error) {
    throw new Error(`Failed to list containers: ${error}`);
  }
}

export async function getContainer(nodeName: string): Promise<Docker.Container | null> {
  try {
    const containerName = getContainerName(nodeName);
    const containers = await docker.listContainers({ all: true });
    const containerInfo = containers.find((c: Docker.ContainerInfo) => 
      c.Names?.some((name: string) => name.includes(`/${containerName}`))
    );

    if (!containerInfo) {
      return null;
    }

    return docker.getContainer(containerInfo.Id);
  } catch (error) {
    throw new Error(`Failed to get container: ${error}`);
  }
}

export async function getContainerStatus(nodeName: string): Promise<{
  exists: boolean;
  running: boolean;
  id?: string;
  port?: number;
}> {
  const container = await getContainer(nodeName);
  
  if (!container) {
    return { exists: false, running: false };
  }

  try {
    const info = await container.inspect();
    const isRunning = info.State.Running;
    const ports = info.NetworkSettings?.Ports?.['17888/tcp'];
    const hostPort = ports?.[0]?.HostPort;

    return {
      exists: true,
      running: isRunning,
      id: info.Id,
      port: hostPort ? parseInt(hostPort, 10) : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to inspect container: ${error}`);
  }
}

async function checkImageExists(imageName: string): Promise<boolean> {
  try {
    const images = await docker.listImages();
    return images.some((img: Docker.ImageInfo) => 
      img.RepoTags?.some(tag => tag === imageName)
    );
  } catch {
    return false;
  }
}

export async function startContainer(nodeName: string, port: number): Promise<string> {
  const container = await getContainer(nodeName);
  
  if (container) {
    // Container exists, check if it's running
    const status = await getContainerStatus(nodeName);
    if (status.running) {
      throw new Error(`Container ${nodeName} is already running`);
    }
    
    // Start existing container
    await container.start();
    return status.id || '';
  }

  // Check if image exists before creating container
  const imageExists = await checkImageExists(config.dockerImage);
  if (!imageExists) {
    throw new Error(`Docker image ${config.dockerImage} not found. Please pull it first: docker pull ${config.dockerImage}`);
  }

  // Create new container
  const containerName = getContainerName(nodeName);
  const nodeDataDir = getNodeDataDir(nodeName);

  try {
    // Calculate ports for 15888, 17888, 17935
    // Port 17888 is the main port (passed as parameter)
    // Port 15888 is 2000 less than 17888
    // Port 17935 is 47 more than 17888
    const port15888 = port - 2000;
    const port17935 = port + 47;

    const container = await docker.createContainer({
      Image: config.dockerImage,
      name: containerName,
      ExposedPorts: {
        '15888/tcp': {},
        '17888/tcp': {},
        '17935/tcp': {},
      },
      Env: [
        `EDGELAUNCHER_CONFIG_PATH=/edgelauncher/data/mainnet`,
        `PASSWORD=${config.password}`,
      ],
      HostConfig: {
        PortBindings: {
          '15888/tcp': [{ HostPort: port15888.toString() }],
          '17888/tcp': [{ HostPort: port.toString() }],
          '17935/tcp': [{ HostPort: port17935.toString() }],
        },
        Binds: [
          `${nodeDataDir}:/edgelauncher/data/mainnet`,
        ],
      },
      Labels: {
        'managed-by': 'theta-node-manager',
        'node-name': nodeName,
      },
    });

    await container.start();
    
    const info = await container.inspect();
    return info.Id;
  } catch (error: any) {
    if (error.statusCode === 409) {
      throw new Error(`Container ${nodeName} already exists`);
    }
    throw new Error(`Failed to create container: ${error.message}`);
  }
}

export async function stopContainer(nodeName: string): Promise<void> {
  const container = await getContainer(nodeName);
  
  if (!container) {
    throw new Error(`Container ${nodeName} not found`);
  }

  try {
    const status = await getContainerStatus(nodeName);
    if (!status.running) {
      throw new Error(`Container ${nodeName} is not running`);
    }

    await container.stop();
  } catch (error: any) {
    if (error.statusCode === 304) {
      // Already stopped
      return;
    }
    throw new Error(`Failed to stop container: ${error.message}`);
  }
}

export async function removeContainer(nodeName: string): Promise<void> {
  const container = await getContainer(nodeName);
  
  if (!container) {
    return; // Already removed or doesn't exist
  }

  try {
    const status = await getContainerStatus(nodeName);
    if (status.running) {
      await container.stop();
    }
    await container.remove();
  } catch (error: any) {
    if (error.statusCode === 404) {
      return; // Already removed
    }
    throw new Error(`Failed to remove container: ${error.message}`);
  }
}


import { Router, Request, Response } from 'express';
import { getAllNodes, getNode, createNode, updateNode, deleteNode } from '../services/metadata.service';
import { 
  getContainerStatus, 
  startContainer, 
  stopContainer,
  getContainerName 
} from '../services/docker.service';
import { nodeService } from '../services/node.service';
import { 
  readKeystore, 
  writeKeystoreFromJSON, 
  keystoreExists,
  ensureNodeDataDir 
} from '../services/keystore.service';
import { CreateNodeRequest, CreateNodeWithKeystoreRequest } from '../types';

const router = Router();

// GET /nodes - List all nodes
router.get('/', async (req: Request, res: Response) => {
  try {
    const nodes = await getAllNodes();
    
    // Enrich with container status
    const nodesWithStatus = await Promise.all(
      nodes.map(async (node) => {
        const containerStatus = await getContainerStatus(node.name);
        return {
          ...node,
          status: containerStatus.running ? 'running' : 'stopped',
          containerId: containerStatus.id,
        };
      })
    );

    res.json({ nodes: nodesWithStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /nodes/:id/status - Get detailed node status
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const nodeName = req.params.id;
    const node = await getNode(nodeName);

    if (!node) {
      res.status(404).json({ error: `Node ${nodeName} not found` });
      return;
    }

    const containerStatus = await getContainerStatus(nodeName);
    
    let rpcInfo: any = {};
    if (containerStatus.running && containerStatus.port) {
      try {
        rpcInfo = await nodeService.getNodeInfo(containerStatus.port);
      } catch (error: any) {
        rpcInfo = { error: error.message };
      }
    }

    res.json({
      container: {
        id: containerStatus.id,
        name: node.containerName || getContainerName(nodeName),
        status: containerStatus.running ? 'running' : 'stopped',
        ports: containerStatus.port ? { '17888': containerStatus.port.toString() } : {},
      },
      rpc: rpcInfo,
      metadata: {
        ...node,
        status: containerStatus.running ? 'running' : 'stopped',
        containerId: containerStatus.id,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /nodes/:id/keystore - Download keystore file
router.get('/:id/keystore', async (req: Request, res: Response) => {
  try {
    const nodeName = req.params.id;
    const node = await getNode(nodeName);

    if (!node) {
      res.status(404).json({ error: `Node ${nodeName} not found` });
      return;
    }

    const keystoreData = await readKeystore(nodeName);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${nodeName}-keystore.json"`);
    res.send(keystoreData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nodes/new - Create new node with auto-generated keystore
router.post('/new', async (req: Request, res: Response) => {
  try {
    const body: CreateNodeRequest = req.body;
    
    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({ error: 'Node name is required' });
      return;
    }

    // Validate name format (alphanumeric and hyphens)
    if (!/^[a-zA-Z0-9-_]+$/.test(body.name)) {
      res.status(400).json({ error: 'Invalid node name. Use alphanumeric characters, hyphens, or underscores' });
      return;
    }

    // Ensure node data directory exists
    await ensureNodeDataDir(body.name);

    // Create node metadata
    const keystorePath = `edgecore/key/encrypted`;
    const node = await createNode(body.name, keystorePath);

    // Start the container (it will generate its own keystore on first run)
    try {
      const containerId = await startContainer(body.name, node.port);
      const containerName = getContainerName(body.name);
      await updateNode(body.name, { containerId, containerName, status: 'running' });
    } catch (error: any) {
      // Rollback: delete node metadata if container creation fails
      await deleteNode(body.name);
      throw error;
    }

    res.status(201).json({ 
      message: `Node ${body.name} created and started`,
      node: {
        ...node,
        status: 'running',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nodes/new-with-keystore - Create node with uploaded keystore
router.post('/new-with-keystore', async (req: Request, res: Response) => {
  try {
    const body: CreateNodeWithKeystoreRequest = req.body;
    
    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({ error: 'Node name is required' });
      return;
    }

    if (!body.keystore || typeof body.keystore !== 'object' || Array.isArray(body.keystore)) {
      res.status(400).json({ error: 'Keystore (JSON object) is required' });
      return;
    }

    // Validate name format
    if (!/^[a-zA-Z0-9-_]+$/.test(body.name)) {
      res.status(400).json({ error: 'Invalid node name. Use alphanumeric characters, hyphens, or underscores' });
      return;
    }

    // Ensure node data directory exists
    await ensureNodeDataDir(body.name);

    // Write keystore file
    await writeKeystoreFromJSON(body.name, body.keystore);

    // Create node metadata
    const keystorePath = `edgecore/key/encrypted`;
    const node = await createNode(body.name, keystorePath);

    // Start the container
    try {
      const containerId = await startContainer(body.name, node.port);
      const containerName = getContainerName(body.name);
      await updateNode(body.name, { containerId, containerName, status: 'running' });
    } catch (error: any) {
      // Rollback: delete node metadata if container creation fails
      await deleteNode(body.name);
      throw error;
    }

    res.status(201).json({ 
      message: `Node ${body.name} created with custom keystore and started`,
      node: {
        ...node,
        status: 'running',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nodes/:id/start - Start a node
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const nodeName = req.params.id;
    const node = await getNode(nodeName);

    if (!node) {
      res.status(404).json({ error: `Node ${nodeName} not found` });
      return;
    }

    const containerStatus = await getContainerStatus(nodeName);
    
    if (containerStatus.running) {
      res.status(400).json({ error: `Node ${nodeName} is already running` });
      return;
    }

    const containerId = await startContainer(nodeName, node.port);
    const containerName = getContainerName(nodeName);
    await updateNode(nodeName, { containerId, containerName, status: 'running' });

    res.json({ 
      message: `Node ${nodeName} started`,
      node: {
        ...node,
        status: 'running',
        containerId,
        containerName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /nodes/:id/stop - Stop a node
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const nodeName = req.params.id;
    const node = await getNode(nodeName);

    if (!node) {
      res.status(404).json({ error: `Node ${nodeName} not found` });
      return;
    }

    const containerStatus = await getContainerStatus(nodeName);
    
    if (!containerStatus.running) {
      res.status(400).json({ error: `Node ${nodeName} is not running` });
      return;
    }

    await stopContainer(nodeName);
    await updateNode(nodeName, { status: 'stopped' });

    res.json({ 
      message: `Node ${nodeName} stopped`,
      node: {
        ...node,
        status: 'stopped',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


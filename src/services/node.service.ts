import axios, { AxiosInstance } from 'axios';

interface RPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface RPCResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number;
}

export class NodeService {
  private createRPCClient(port: number): AxiosInstance {
    return axios.create({
      baseURL: `http://localhost:${port}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async callRPC(port: number, method: string, params: any[] = []): Promise<any> {
    const client = this.createRPCClient(port);
    const request: RPCRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    };

    try {
      const response = await client.post<RPCResponse>('/rpc', request);
      
      if (response.data.error) {
        throw new Error(`RPC error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error(`Node not responding on port ${port}`);
      }
      if (error.response?.data?.error) {
        throw new Error(`RPC error: ${error.response.data.error.message}`);
      }
      throw new Error(`Failed to call RPC: ${error.message}`);
    }
  }

  async getStatus(port: number): Promise<any> {
    return this.callRPC(port, 'edgecore.GetStatus');
  }

  async getEdgeNodeSummary(port: number): Promise<any> {
    return this.callRPC(port, 'edgecore.GetEdgeNodeSummary');
  }

  async getNodeInfo(port: number): Promise<{
    status?: any;
    summary?: any;
    address?: string;
    error?: string;
  }> {
    try {
      const [status, summary] = await Promise.all([
        this.getStatus(port).catch(() => null),
        this.getEdgeNodeSummary(port).catch(() => null),
      ]);

      // Extract address from status or summary
      let address: string | undefined;
      if (status?.address) {
        address = status.address;
      } else if (summary?.address) {
        address = summary.address;
      } else if (status?.result?.address) {
        address = status.result.address;
      } else if (summary?.result?.address) {
        address = summary.result.address;
      }

      return {
        status: status || undefined,
        summary: summary || undefined,
        address,
      };
    } catch (error: any) {
      return {
        error: error.message,
      };
    }
  }
}

export const nodeService = new NodeService();


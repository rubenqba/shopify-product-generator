import { Injectable } from '@nestjs/common';
import { Resource, Tool } from '@rekog/mcp-nest';
import { StoreService } from './store.service';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

@Injectable()
export class ShopifyStoreTool {
  constructor(private readonly store: StoreService) {}

  @Tool({
    name: 'check-shopify-store-health',
    description: 'Check the health of the Shopify store',
  })
  async checkStoreHealth(): Promise<CallToolResult> {
    const status = await this.store.checkHealth();

    return {
      content: [{ type: 'text', text: `Store health status: ${status.status}` }],
    };
  }

  @Resource({
    uri: 'mcp://shopify/store/health',
    name: 'Get Store Health',
    description: 'Get the health status of the Shopify store',
    mimeType: 'text/plain',
  })
  async getCurrentSchema({ uri }: { uri: string }) {
    return {
      contents: [
        {
          uri: uri,
          mimeType: 'text/plain',
          text: JSON.stringify(await this.store.checkHealth()),
        },
      ],
    };
  }
}

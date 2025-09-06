import { Injectable, Logger } from '@nestjs/common';
import { Prompt, Resource, ResourceTemplate, Tool } from '@rekog/mcp-nest';
import { type CallToolResult, type GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { type CreateProduct, CreateProductSchema, ProductSearchParams } from './store.dto';
import { ShopifyService } from './shopify.service';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { PromptLoaderService } from 'src/common/prompt-loader.service';

@Injectable()
export class ShopifyStoreTool {
  private readonly log = new Logger(ShopifyStoreTool.name);

  constructor(
    private readonly store: ShopifyService,
    private readonly promptLoader: PromptLoaderService,
  ) {}

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
    uri: 'shopify://store/health',
    name: 'Get Store Health',
    description: 'Get the health status of the Shopify store',
    mimeType: 'application/json',
  })
  async getCurrentSchema({ uri }: { uri: string }) {
    return {
      contents: [
        {
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify(await this.store.checkHealth()),
        },
      ],
    };
  }

  @ResourceTemplate({
    uriTemplate: 'shopify://store/products/{query}/{page}/{limit}',
    name: 'shopify-product-search',
    description: 'Search for products in the Shopify store',
    mimeType: 'application/json',
  })
  async searchProducts({
    uri,
    page = 1,
    limit = 10,
    query,
    mimeType,
  }: {
    uri: string;
    query: string;
    page?: number;
    limit?: number;
    mimeType?: string;
  }) {
    const params: ProductSearchParams = {
      page,
      limit,
      query,
      filters: { available_only: true },
      sort: [],
    };
    const results = await this.store.search(params);
    return {
      contents: [
        {
          uri,
          mimeType: mimeType ?? 'application/json',
          text: JSON.stringify(results),
        },
      ],
    };
  }

  @Tool({
    name: 'shopify-product-search',
    description: 'Search for products in the Shopify store',
    annotations: {
      readOnlyHint: true,
    },
    parameters: z.object({
      query: z.string().optional().describe('The search query for products'),
      page: z.number().min(1).default(1).describe('The page number to retrieve, default 1'),
      limit: z.number().min(1).max(100).default(10).describe('The number of products to retrieve per page, default 10'),
    }),
  })
  async searchTool({
    page = 1,
    limit = 10,
    query,
  }: {
    page: number;
    limit: number;
    query?: string;
  }): Promise<CallToolResult> {
    const params: ProductSearchParams = {
      page,
      limit,
      query,
      filters: { available_only: true },
      sort: [],
    };
    const results = await this.store.search(params);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results),
        },
      ],
    };
  }

  @ResourceTemplate({
    name: 'shopify-product-lookup-resource',
    description: 'Lookup a product by its identifier in the Shopify store',
    mimeType: 'application/json',
    uriTemplate: 'shopify://store/product/{identifier}',
  })
  async lookupProductResource({ uri, identifier }: { uri: string; identifier: string }) {
    try {
      const product = await this.store.findProduct(identifier);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(product),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: (error as Error).message }),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'shopify-product-lookup',
    description: 'Lookup a product by its identifier in the Shopify store',
    annotations: {
      readOnlyHint: true,
    },
    parameters: z.object({
      resource_id: z.string().describe('The unique identifier of the product to look up'),
    }),
  })
  async lookupProductTool({ resource_id }: { resource_id: string }): Promise<CallToolResult> {
    try {
      const identifier = resource_id;
      const product = await this.store.findProduct(identifier);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(product),
          },
          {
            type: 'resource_link',
            name: `Product: ${product.title}`,
            uri: `shopify://store/product/${product.id}`,
            mimeType: 'application/json',
            title: product.title,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: (error as Error).message }),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'shopify-store-locations',
    description: 'Retrieve the list of store locations from Shopify',
    annotations: {
      readOnlyHint: true,
    },
  })
  async listLocationsTool(): Promise<CallToolResult> {
    try {
      const locations = await this.store.locations();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(locations),
          },
          {
            type: 'resource_link',
            name: `Store locations`,
            uri: `shopify://store/locations`,
            mimeType: 'application/json',
            title: `Store locations`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: (error as Error).message }),
          },
        ],
      };
    }
  }

  @Tool({
    name: 'shopify-product-create',
    description: 'Create a new product in the Shopify store',
    annotations: {
      readOnlyHint: false,
    },
    parameters: CreateProductSchema,
  })
  async createProductTool(data: CreateProduct): Promise<CallToolResult> {
    try {
      const id = await this.store.create(data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data),
          },
          {
            type: 'resource_link',
            name: `New product: ${id}`,
            uri: `shopify://store/product/${id}`,
            mimeType: 'application/json',
            title: `New product: ${id}`,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: (error as Error).message }),
          },
        ],
      };
    }
  }

  @Prompt({
    name: 'shopify-create-product-prompt',
    description: 'Genera un payload JSON válido para crear un producto a partir de una categoría y un idioma.',
  })
  async createProductPrompt(): Promise<GetPromptResult> {
    const prompt = (await this.promptLoader.getPrompt('create-product.md')).replace(/{language}/g, 'spanish');

    return {
      description:
        'Genera un payload JSON válido para crear un producto a partir de una categoría (zapatos, ropa, electrónicos, computadoras, etc.). Consulta locations con las tools disponibles.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${prompt}`,
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${JSON.stringify(zodToJsonSchema(CreateProductSchema))}`,
          },
        },
      ],
    };
  }
}

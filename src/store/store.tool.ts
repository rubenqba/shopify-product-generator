import { Injectable, Logger } from '@nestjs/common';
import { Prompt, Resource, ResourceTemplate, Tool } from '@rekog/mcp-nest';
import { type CallToolResult, type GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { type CreateProduct, CreateProductSchema, FileSetSchema, ProductSearchParams } from './store.dto';
import { ShopifyService } from './shopify.service';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { PromptLoaderService } from 'src/common/prompt-loader.service';
import { UnsplashService } from 'src/unsplash/unsplash.service';
import { UnsplashImageMinimal } from 'src/unsplash/unsplash.dto';

@Injectable()
export class ShopifyStoreTool {
  private readonly log = new Logger(ShopifyStoreTool.name);

  constructor(
    private readonly store: ShopifyService,
    private readonly promptLoader: PromptLoaderService,
    private readonly unsplash: UnsplashService,
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
  async checkStoreHealthResource({ uri }: { uri: string }) {
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

  @Resource({
    uri: 'shopify://store/locations',
    name: 'Get Store Locations',
    description: 'Get the list of locations for the Shopify store',
    mimeType: 'application/json',
  })
  async checkStoreLocationsResource({ uri }: { uri: string }) {
    return {
      contents: [
        {
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify(await this.store.locations()),
        },
      ],
    };
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
      this.log.debug('Creating product:', JSON.stringify(data));
      const id = await this.store.create(data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(id),
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

  @Tool({
    name: 'shopify-generate-product-images',
    description: 'Generate product images using Unsplash API',
    parameters: z.object({
      query: z.string().min(2).max(100),
      count: z.number().min(1).max(10).optional(),
    }),
  })
  async generateProductImages({ query, count = 3 }: { query: string; count?: number }): Promise<CallToolResult> {
    try {
      const sources = await this.unsplash.searchPhotos(query, { per_page: count });
      const images = await Promise.all(sources.map((img) => this.unsplashToFileSet(img)));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(images),
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

  // Construye una URL con lado largo ≤ 2048 y ajustes recomendados
  private toMaxSide2048(url: string) {
    const u = new URL(url);
    // forzamos JPG sRGB con compresión razonable
    u.searchParams.set('w', '2048');
    u.searchParams.set('q', '85');
    u.searchParams.set('fm', 'jpg');
    u.searchParams.set('cs', 'srgb');
    return u.toString();
  }

  /**
   * Mapea el objeto de Unsplash a tu FileSetSchema (contentType: 'IMAGE')
   * - Usa urls.raw para poder fijar w=2048
   * - filename basado en slug o id
   * - alt de alt_description/description
   * - Conserva datos útiles por si registras descarga/atribución en otra parte
   */
  private async unsplashToFileSet(img: UnsplashImageMinimal) {
    const originalSource = await this.unsplash.getDownloadUrl(img.id).then((url) => this.toMaxSide2048(url));
    const alt = (img.alt_description ?? undefined) || (img.description ?? undefined);

    return {
      originalSource,
      alt,
      contentType: 'IMAGE' as const,
      // Si quieres, guarda aparte:
      _meta: {
        image_id: img.id,
        authorUsername: img.user.username,
        authorName: img.user.name,
        blurHash: img.blur_hash,
        color: img.color,
        mimeType: 'image/jpeg',
      },
    };
  }

  @Prompt({
    name: 'shopify-generate-product-images-prompt',
    description:
      'This prompt helps LLMs create queries and structured image objects for the `shopify-generate-product-images` tool. Output is schema-compliant and ready for use with other MCP Shopify product tools.',
  })
  async generateProductImagesPrompt(): Promise<GetPromptResult> {
    try {
      const prompt = await this.promptLoader.getPrompt('generate-images.md');

      return {
        description:
          'This prompt assists LLMs and agents in generating relevant product image queries and structured image data objects for mock Shopify products, using the MCP tool shopify-generate-product-images. It guides the model to create detailed English-language queries based on the product category or description, specify the desired number of images, and return image object arrays compliant with the required schema. These images can later be integrated with other MCP tools such as product creation flows, enabling automated and contextually appropriate image provisioning for Shopify mock products.',
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
              text: `${JSON.stringify(zodToJsonSchema(FileSetSchema.array()))}`,
            },
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: JSON.stringify({ error: (error as Error).message }),
            },
          },
        ],
      };
    }
  }
}

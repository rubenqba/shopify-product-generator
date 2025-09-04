/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// shopify.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { HealthStatus } from './store.dto';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private shopify: ReturnType<typeof shopifyApi>;
  private session: Session;

  constructor(private config: ConfigService) {
    this.initializeShopify();
    this.createSession();
  }

  private createSession() {
    const shop = this.config.getOrThrow<string>('shopify.shop');
    this.session = Session.fromPropertyArray(
      [
        ['id', `offline_${shop}`],
        ['shop', shop],
        ['isOnline', false],
        ['scope', this.config.get<string>('shopify.scope', 'write_products')],
        ['accessToken', this.config.getOrThrow<string>('shopify.accessToken')],
      ],
      false,
    );
  }

  private initializeShopify() {
    this.shopify = shopifyApi({
      apiVersion: LATEST_API_VERSION,
      apiKey: this.config.getOrThrow<string>('shopify.key'),
      apiSecretKey: this.config.getOrThrow<string>('shopify.secret'),
      hostName: this.config.getOrThrow<string>('shopify.host'),
      isEmbeddedApp: false,
    });

    this.logger.log('Shopify API initialized');
  }

  // Cliente GraphQL
  async graphqlRequest<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>) {
    try {
      const client = new this.shopify.clients.Graphql({ session: this.session });
      const response = await client.request<T>(query, variables);

      return response.data;
    } catch (error) {
      this.logger.error('GraphQL request failed:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<HealthStatus> {
    try {
      const query = `
        query {
          shop {
            id
            name
            email
          }
        }
      `;

      type ShopDefinition = {
        id: string;
        name: string;
        email: string;
      };

      const data = await this.graphqlRequest<ShopDefinition>(query);
      if (data) {
        this.logger.debug(`Shopify API is healthy`, { data });
        return {
          status: 'healthy',
          lastCheck: new Date(),
        };
      } else {
        this.logger.warn('Shopify API returned no data');
        return {
          status: 'warning',
          lastCheck: new Date(),
          message: `No data returned from Shopify API`,
        };
      }
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'error',
        lastCheck: new Date(),
        message: (error as Error).message,
      };
    }
  }

  // Ejemplos de uso con GraphQL
  async getProducts(first: number = 10) {
    const query = `
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              createdAt
              updatedAt
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.graphqlRequest(query, { first });
  }

  async getOrders(first: number = 10) {
    const query = `
      query getOrders($first: Int!) {
        orders(first: $first) {
          edges {
            node {
              id
              name
              email
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.graphqlRequest(query, { first });
  }

  async updateProductInventory(variantId: string, inventoryQuantity: number) {
    const mutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          inventoryAdjustmentGroup {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        reason: 'correction',
        setQuantities: [
          {
            inventoryItemId: variantId,
            locationId: this.config.get<string>('SHOPIFY_LOCATION_ID'),
            quantity: inventoryQuantity,
          },
        ],
      },
    };

    return this.graphqlRequest(mutation, variables);
  }

  // Getter para la session (por si necesitas acceso directo)
  getSession(): Session {
    return this.session;
  }

  // Getter para el cliente Shopify (por si necesitas funcionalidades avanzadas)
  getShopifyClient() {
    return this.shopify;
  }
}

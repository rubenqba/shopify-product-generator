// shopify.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import {
  CreateProduct,
  HealthStatus,
  ProductPage,
  ProductSearchParams,
  StoreLocation,
  UnifiedProduct,
} from './store.dto';

type GQLMediaImage = {
  __typename: 'MediaImage';
  id: string;
  mediaContentType: 'IMAGE';
  image: { url: string; altText?: string | null } | null;
  preview?: { image?: { url: string; altText?: string | null } | null } | null;
};

type GQLMediaNode =
  | GQLMediaImage
  | {
      __typename: 'Video' | 'ExternalVideo' | 'Model3d';
      mediaContentType: string;
      id: string;
      preview?: { image?: { url: string; altText?: string | null } | null } | null;
    };

type GQLProductVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  inventoryQuantity?: number | null;
  price: string;
  sku: string | null;
  selectedOptions: { name: string; value: string }[];
};

type GQLProductNode = {
  id: string;
  title: string;
  description?: string | null;
  handle?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tags: string[];
  updatedAt: string;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  featuredMedia?: GQLMediaImage | null;
  media: { edges: { node: GQLMediaNode }[] };
  variants: {
    edges: {
      node: GQLProductVariantNode;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  };
};

const LIST_VARIANTS_PAGE_SIZE = 5; // para search (performance)
const DETAILS_VARIANTS_PAGE_SIZE = 250; // máximo recomendado en GraphQL Admin
const THUMB_MAX = 320; // tamaño “cuadro” recomendado para chat (≈320px). Retina: scale 2 → ~640px

@Injectable()
export class ShopifyService {
  private readonly log = new Logger(ShopifyService.name);
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

    this.log.log('Shopify API initialized');
  }

  // Cliente GraphQL
  async graphqlRequest<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>) {
    try {
      const client = new this.shopify.clients.Graphql({ session: this.session });
      const response = await client.request<T>(query, variables);

      return response;
    } catch (error) {
      this.log.error('GraphQL request failed:', error);
      throw error;
    }
  }

  /**
   * Helpers
   */
  private extractPrimaryImage(p: GQLProductNode): { url: string; alt?: string } | undefined {
    // 1) featuredMedia (si es imagen)
    if (p.featuredMedia?.__typename === 'MediaImage') {
      const url = p.featuredMedia.image?.url ?? p.featuredMedia.preview?.image?.url ?? null;
      const alt = p.featuredMedia.image?.altText ?? p.featuredMedia.preview?.image?.altText ?? undefined;
      if (url) return { url, alt };
    }
    // 2) primera imagen en media
    for (const edge of p.media?.edges ?? []) {
      const n = edge.node;
      if (n.__typename === 'MediaImage') {
        const url = n.image?.url ?? n.preview?.image?.url ?? null;
        const alt = n.image?.altText ?? n.preview?.image?.altText ?? undefined;
        if (url) return { url, alt };
      }
      // 3) si es video/3d, usa su preview.image (como fallback)
      const prev = n.preview?.image;
      if (prev?.url) return { url: prev.url, alt: prev.altText ?? undefined };
    }
    return undefined;
  }

  private mapUnifiedProduct(p: GQLProductNode): UnifiedProduct {
    const min = parseFloat(p.priceRangeV2.minVariantPrice.amount);
    const max = parseFloat(p.priceRangeV2.maxVariantPrice.amount);
    const currency = p.priceRangeV2.minVariantPrice.currencyCode;

    const primary = this.extractPrimaryImage(p);
    const images = primary ? [primary] : []; // 👈 solo UNA imagen para chat
    const generateOptions = (node: GQLProductVariantNode) => {
      const options = node.selectedOptions?.map((o) => ({ name: o.name, value: o.value })) ?? [];
      if (node.sku) {
        options.push({ name: 'SKU', value: node.sku });
      }
      return options;
    };

    return {
      id: this.simplifyProductGid(p.id),
      title: p.title,
      description: p.description ?? undefined,
      source: 'shopify',
      price_range: { min, max, currency },
      images,
      variants: (p.variants.edges ?? []).map(({ node }) => ({
        id: this.simplifyProductVariantGid(node.id),
        title: node.title,
        price: parseFloat(node.price),
        available: node.availableForSale,
        inventory_quantity: typeof node.inventoryQuantity === 'number' ? node.inventoryQuantity : undefined,
        options: generateOptions(node),
      })),
      handle: p.handle ?? undefined,
      product_type: p.productType ?? undefined,
      vendor: p.vendor ?? undefined,
      tags: p.tags ?? [],
      source_metadata: {
        // last_updated: new Date(p.updatedAt),
        source_id: this.simplifyProductGid(p.id),
        sync_status: 'synced',
      },
    };
  }

  private mapSort(params: ProductSearchParams): { sortKey: string; reverse: boolean } {
    const [first] = params.sort ?? [];
    if (!first) return params.query ? { sortKey: 'RELEVANCE', reverse: false } : { sortKey: 'ID', reverse: false };

    const dir = (first.dir ?? 'asc').toLowerCase() === 'desc';
    switch (first.by) {
      case 'updated':
        return { sortKey: 'UPDATED_AT', reverse: dir };
      case 'name':
        return { sortKey: 'TITLE', reverse: dir };
      default:
        if (params.query) {
          return { sortKey: 'RELEVANCE', reverse: false };
        } else {
          return { sortKey: 'ID', reverse: false };
        }
    }
  }

  private buildShopifyQuery(params: ProductSearchParams): string {
    const parts: string[] = [];

    // Texto libre (Shopify "default" search). Si quieres acotar a título: usa title:'...'
    if (params.query && params.query.trim()) {
      parts.push(this.escapeDefault(params.query.trim()));
    }

    const f = params.filters ?? {};
    if (f.vendor) parts.push(this.kv('vendor', f.vendor));
    if (f.category) parts.push(this.kv('product_type', f.category));
    if (typeof f.price_min === 'number') parts.push(`price:>=${f.price_min}`);
    if (typeof f.price_max === 'number') parts.push(`price:<=${f.price_max}`);
    if (f.available_only) parts.push('inventory_total:>0');

    // Puedes añadir otros filtros soportados por Shopify aquí:
    // - published_status, status, tag, sku, etc.

    return parts.join(' ');
  }

  private kv(key: string, value: string): string {
    // Escapamos comillas simples en valores y rodeamos con comillas simples (Shopify search syntax)
    const v = value.replace(/'/g, "\\'");
    return `${key}:'${v}'`;
  }

  private escapeDefault(q: string): string {
    // Para el filtro "default" basta con pasar el texto; si contiene comillas, las escapamos mínimamente.
    return q.replace(/"/g, '\\"');
  }

  private simplifyProductGid(id: string): string {
    return id.replace('gid://shopify/Product/', '');
  }

  private simplifyProductVariantGid(id: string): string {
    return id.replace('gid://shopify/ProductVariant/', '');
  }

  private simplifyGid(id: string): string {
    return id.replace(/^gid:\/\/shopify\/[^/]+\/(.+)$/, '$1');
  }

  private ensureProductGid(id: string): string {
    // Acepta gid://shopify/Product/123 o un ID numérico y lo convierte a GID
    if (id.startsWith('gid://shopify/Product/')) return id;
    if (/^\d+$/.test(id)) return `gid://shopify/Product/${id}`;
    // En caso de que manden un handle por error, podrías resolverlo con productByHandle
    throw new Error(`Unsupported Shopify product identifier: ${id}`);
  }

  private async fetchAdditionalVariants(id: string, after?: string): Promise<GQLProductNode['variants']['edges']> {
    const variants: GQLProductNode['variants']['edges'] = [];
    let hasNext = true;
    let next = after || null;
    while (hasNext) {
      // Traer solo variantes adicionales para este producto
      const { data: moreData } = await this.graphqlRequest<{ product: { variants: GQLProductNode['variants'] } }>(
        Queries.PRODUCT_VARIANTS_PAGE,
        {
          variables: {
            id,
            variantsPageSize: DETAILS_VARIANTS_PAGE_SIZE,
            after: next,
          },
        },
      );

      const chunk = moreData?.product?.variants;
      if (!chunk) break;

      variants.push(...chunk.edges);
      hasNext = chunk.pageInfo.hasNextPage;
      next = chunk.pageInfo.endCursor || null;
    }
    return variants;
  }

  // -- Operations ---

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

      const { data } = await this.graphqlRequest<ShopDefinition>(query);
      if (data) {
        this.log.debug(`Shopify API is healthy`, { data });
        return {
          status: 'healthy',
          lastCheck: new Date(),
        };
      } else {
        this.log.warn('Shopify API returned no data');
        return {
          status: 'warning',
          lastCheck: new Date(),
          message: `No data returned from Shopify API`,
        };
      }
    } catch (error) {
      this.log.error('Health check failed:', error);
      return {
        status: 'error',
        lastCheck: new Date(),
        message: (error as Error).message,
      };
    }
  }

  async countProducts(params: ProductSearchParams): Promise<number> {
    try {
      type GQLProductsCountResponse = {
        productsCount: { count: number; precision: 'EXACT' | 'LOW' | 'HIGH' | 'DEFAULT' };
      };

      const queryString = this.buildShopifyQuery(params);
      const response = await this.graphqlRequest<GQLProductsCountResponse>(Queries.PRODUCT_COUNT, {
        variables: { query: queryString || null },
      });

      if (response.data) {
        this.log.debug(`Shopify API returned product count`, { count: response.data.productsCount });
        return response.data.productsCount.count;
      } else {
        this.log.warn('Shopify API returned no data');
        return 0;
      }
    } catch (error) {
      this.log.error('Error counting products', { error });
      return 0;
    }
  }

  // Ejemplos de uso con GraphQL
  async search(params: ProductSearchParams): Promise<ProductPage> {
    const queryString = this.buildShopifyQuery(params);
    const { sortKey, reverse } = this.mapSort(params);

    const total = await this.countProducts(params);

    // 2) avanza hasta la página solicitada usando cursores
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(params.limit || 20, 250));
    let after: string | null | undefined = null;

    type GQLProductsResponse = {
      products: {
        edges: { cursor: string; node: GQLProductNode }[];
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; endCursor?: string | null };
      };
    };

    // Avance por páginas previas (page-1 requests)
    for (let i = 1; i < page; i += 1) {
      const pageHop: { data?: GQLProductsResponse } = await this.graphqlRequest<GQLProductsResponse>(
        Queries.PRODUCT_SEARCH,
        {
          variables: {
            first: limit,
            after,
            query: queryString || null,
            sortKey,
            reverse,
            variantsPageSize: LIST_VARIANTS_PAGE_SIZE,
            thumbMax: THUMB_MAX, // 👈 aquí fijas el tamaño “chat”
          },
        },
      );
      const pageInfo = pageHop.data?.products?.pageInfo;
      if (!pageInfo?.hasNextPage) {
        // Página solicitada está fuera de rango; devolver lista vacía con meta coherente
        return {
          meta: {
            total,
            page,
            limit,
            hasPrev: page > 1,
            hasNext: false,
          },
          items: [],
        };
      }
      after = pageInfo.endCursor ?? null;
    }

    // 3) página actual
    const { data: resData } = await this.graphqlRequest<GQLProductsResponse>(Queries.PRODUCT_SEARCH, {
      variables: {
        first: limit,
        after,
        query: queryString || null,
        sortKey,
        reverse,
        variantsPageSize: LIST_VARIANTS_PAGE_SIZE,
        thumbMax: THUMB_MAX, // 👈 aquí fijas el tamaño “chat”
      },
    });

    const edges = resData?.products?.edges ?? [];
    const pageInfo = resData?.products?.pageInfo;

    const items = edges.map((e: { node: GQLProductNode }) => this.mapUnifiedProduct(e.node));

    return {
      meta: {
        total,
        page,
        limit,
        hasPrev: page > 1,
        hasNext: Boolean(pageInfo?.hasNextPage),
      },
      items,
    };
  }

  async findProduct(id: string): Promise<UnifiedProduct> {
    const shopifyGid = this.ensureProductGid(id);

    // Traemos nodo base + primeras variantes
    const { data } = await this.graphqlRequest<{ product: GQLProductNode }>(Queries.PRODUCT_DETAILS, {
      variables: {
        id: shopifyGid,
        variantsPageSize: DETAILS_VARIANTS_PAGE_SIZE,
        thumbMax: THUMB_MAX, // 👈 aquí fijas el tamaño “chat”
      },
    });

    const product = data?.product;
    if (!product) throw new Error(`Shopify product not found: ${id}`);

    // Si hay más variantes, las paginamos
    const variants: GQLProductNode['variants']['edges'] = [...product.variants.edges];
    const hasNext = product.variants.pageInfo.hasNextPage;

    if (hasNext) {
      const additionalVariants = await this.fetchAdditionalVariants(
        shopifyGid,
        product.variants.pageInfo.endCursor ?? undefined,
      );
      variants.push(...additionalVariants);
    }

    // Combinar y mapear
    const merged: GQLProductNode = {
      ...product,
      variants: { ...product.variants, edges: variants },
    };

    return this.mapUnifiedProduct(merged);
  }

  async locations(): Promise<StoreLocation[]> {
    type GQLLocationsResponse = {
      locations: {
        edges: { node: StoreLocation }[];
      };
    };
    const { data } = await this.graphqlRequest<GQLLocationsResponse>(Queries.GET_LOCATIONS);

    return data?.locations?.edges.map((edge) => ({ ...edge.node, id: this.simplifyGid(edge.node.id) })) ?? [];
  }

  async create(dto: CreateProduct): Promise<string> {
    type ProductSetOperation =
      | { id: string; status: 'CREATED' | 'ACTIVE' }
      | { id: string; status: 'COMPLETE'; product: { id: string } };

    type ProductCreateResponse = {
      product?: { id: string } | null; // presente si fue síncrono
      productSetOperation?: ProductSetOperation | null; // presente si fue asíncrono
      userErrors: { field: string[]; message: string; code: string }[];
    };

    const synchronous = dto.variants.length <= 10;
    const { data, errors } = await this.graphqlRequest<{ productSet: ProductCreateResponse }>(
      Queries.CREATE_PRODUCT_MUTATION,
      {
        variables: {
          input: dto,
          synchronous,
        },
      },
    );

    if (errors) {
      throw new Error(`Failed to create product: ${errors.message}`);
    }

    if (!data) {
      throw new Error(`Failed to create product: No response data`);
    }

    const { product, productSetOperation, userErrors } = data.productSet;

    if (userErrors && userErrors.length > 0) {
      throw new Error(`Failed to create product: ${userErrors.map((e) => e.message).join(', ')}`);
    }

    if (synchronous && product) {
      return this.simplifyGid(product.id);
    }

    if (!synchronous && productSetOperation) {
      return productSetOperation.status === 'COMPLETE'
        ? productSetOperation.product.id
        : await this.waitForProductOperation(productSetOperation.id);
    }

    throw new Error('Failed to create product: No debió llegas aqui');
  }

  // Helper: hace polling hasta COMPLETE (o timeout)
  async waitForProductOperation(operationId: string, { intervalMs = 1500, timeoutMs = 120_000 } = {}): Promise<string> {
    type ProductSetOperation =
      | { id: string; status: 'CREATED' | 'ACTIVE'; userErrors: { field: string[]; message: string; code: string }[] }
      | {
          id: string;
          status: 'COMPLETE';
          product: { id: string };
          userErrors: { field: string[]; message: string; code: string }[];
        };

    type ProductOperationResponse = {
      productOperation: ProductSetOperation | null;
    };

    const started = Date.now();
    for (;;) {
      const { data, errors } = await this.graphqlRequest<ProductOperationResponse>(CHECK_PRODUCT_ASYNC_OPERATION, {
        variables: { id: operationId },
      });

      if (errors) throw new Error(`Polling error: ${errors.message ?? JSON.stringify(errors)}`);
      if (!data || !data.productOperation) throw new Error('Polling error: no operation data');

      const op = data.productOperation;

      // Si hay errores de la operación en background, falla de inmediato
      if (op.userErrors?.length) {
        const msg = op.userErrors.map((e) => e.message).join(', ');
        throw new Error(`ProductSet operation failed: ${msg}`);
      }

      if (op.status === 'COMPLETE') {
        const pid = op.product?.id;
        if (!pid) throw new Error('Operation COMPLETE but product id is missing');
        return pid;
      }

      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for productSet operation (last status: ${op.status})`);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

const GET_LOCATIONS = `
  query {
    locations(first: 50) {
      edges {
        node {
          id
          name
          isActive
          fulfillsOnlineOrders
        }
      }
    }
  }
`;

const PRODUCT_COUNT_QUERY = `
  query ProductsCount($query: String) {
    productsCount(query: $query) {
      count
      precision
    }
  }
`;

const PRODUCT_DETAILS_QUERY = /* GraphQL */ `
  query ProductDetails($id: ID!, $variantsPageSize: Int!, $thumbMax: Int!) {
    product(id: $id) {
      id
      title
      description
      handle
      productType
      vendor
      tags
      updatedAt
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      featuredMedia {
        mediaContentType
        ... on MediaImage {
          id
          image {
            altText
            url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
          }
          preview {
            image {
              url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
              altText
            }
          }
        }
        preview {
          image {
            url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
            altText
          }
        }
      }
      media(first: 1) {
        edges {
          node {
            mediaContentType
            ... on MediaImage {
              id
              image {
                altText
                url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
              }
              preview {
                image {
                  url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                  altText
                }
              }
            }
            preview {
              image {
                url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                altText
              }
            }
          }
        }
      }
      variants(first: $variantsPageSize) {
        edges {
          node {
            id
            title
            availableForSale
            inventoryQuantity
            price
            selectedOptions {
              name
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const PRODUCT_VARIANTS_PAGE_QUERY = /* GraphQL */ `
  query ProductVariantsPage($id: ID!, $variantsPageSize: Int!, $after: String) {
    product(id: $id) {
      variants(first: $variantsPageSize, after: $after) {
        edges {
          node {
            id
            title
            availableForSale
            inventoryQuantity
            price {
              amount
              currencyCode
            }
            selectedOptions {
              name
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const PRODUCT_SEARCH_QUERY = /* GraphQL */ `
  query Products(
    $first: Int!
    $after: String
    $query: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $variantsPageSize: Int!
    $thumbMax: Int!
  ) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
        cursor
        node {
          id
          title
          description
          handle
          productType
          vendor
          tags
          updatedAt
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          featuredMedia {
            mediaContentType
            ... on MediaImage {
              id
              image {
                altText
                url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
              }
              preview {
                image {
                  url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                  altText
                }
              }
            }
            preview {
              image {
                url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                altText
              }
            }
          }
          media(first: 1) {
            # 👈 solo 1 como fallback
            edges {
              node {
                mediaContentType
                ... on MediaImage {
                  id
                  image {
                    altText
                    url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                  }
                  preview {
                    image {
                      url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                      altText
                    }
                  }
                }
                preview {
                  image {
                    url(transform: { maxWidth: $thumbMax, maxHeight: $thumbMax, crop: CENTER, scale: 2 })
                    altText
                  }
                }
              }
            }
          }
          variants(first: $variantsPageSize) {
            edges {
              node {
                id
                title
                availableForSale
                inventoryQuantity
                price
                selectedOptions {
                  name
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
    }
  }
`;

const CREATE_PRODUCT_MUTATION = /* GraphQL */ `
  mutation ProductSetMinimalFlexible(
    $input: ProductSetInput!
    $identifier: ProductSetIdentifiers
    $synchronous: Boolean!
  ) {
    productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
      product {
        id
      } # solo estará presente en modo síncrono
      productSetOperation {
        id
        status
      } # solo se devuelve en modo asíncrono
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const CHECK_PRODUCT_ASYNC_OPERATION = `
  query ProductOperationStatus($id: ID!) {
    productOperation(id: $id) {
      id
      status
      product { id }
      userErrors { field message code }
    }
  }
`;

const Queries = {
  PRODUCT_COUNT: PRODUCT_COUNT_QUERY,
  PRODUCT_DETAILS: PRODUCT_DETAILS_QUERY,
  PRODUCT_VARIANTS_PAGE: PRODUCT_VARIANTS_PAGE_QUERY,
  PRODUCT_SEARCH: PRODUCT_SEARCH_QUERY,
  GET_LOCATIONS,
  CREATE_PRODUCT_MUTATION,
  CHECK_PRODUCT_ASYNC_OPERATION,
};

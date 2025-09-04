import { z } from 'zod';

// search and pagination
export const SearchParamsSchema = z.object({
  query: z.string().min(2).max(100).optional().describe('Search query'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const makeSortSchema = <K extends readonly [string, ...string[]]>(keys: K) =>
  z
    // acepta "a,desc" o ["a,desc","b,asc"]
    .union([z.string(), z.array(z.string())])
    .optional()
    // normaliza a array de strings
    .transform((raw) => (raw == null ? [] : Array.isArray(raw) ? raw : [raw]))
    // parsea "campo,dir?" → { by, dir }
    .transform((arr) =>
      arr.map((s) => {
        const [byRaw, dirRaw] = s
          .split(',')
          .map((x) => x?.trim())
          .filter(Boolean);
        const by = byRaw ?? ''; // se valida abajo
        const dir = dirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';
        return { by, dir } as const;
      }),
    )
    // valida que el campo esté permitido
    .refine((arr) => arr.every((it) => (keys as readonly string[]).includes(it.by)), {
      message: 'Campo de orden no permitido',
    })
    // estrecha el tipo de `by` al union K[number]
    .transform((arr) => arr.map((it) => ({ by: it.by as K[number], dir: it.dir })));

export type SortItem<K extends readonly string[]> = {
  by: K[number];
  dir: 'asc' | 'desc';
};

export const queryOf = <T extends z.ZodObject<any>, K extends readonly [string, ...string[]]>(
  item: T,
  sortableKeys: K,
) => {
  return SearchParamsSchema.extend({
    sort: makeSortSchema(sortableKeys),
    filters: item.optional(),
  });
};

const PageBase = z.object({
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

// Factory
export const pageOf = <T extends z.ZodObject<any>>(item: T) => PageBase.extend({ items: z.array(item) });

export const CountryCodeSchema = z
  .string({ required_error: 'Country is required' })
  .length(2, 'Country must be 2 characters long')
  .transform((value) => value.toUpperCase())
  .describe('Country code (ISO 3166-1 alpha-2)');
export type CountryCode = z.infer<typeof CountryCodeSchema>;

export const CurrencySchema = z
  .string()
  .length(3, 'Currency must be 3 characters long')
  .transform((value) => value.toUpperCase())
  .describe('Currency code (ISO 4217)');

export const ImageObjectSchema = z.object({
  url: z.string().url().describe('Image URL'),
  alt: z.string().optional(),
});
export const ImageSchema = z.string().url().or(ImageObjectSchema);
export type ImageObject = z.infer<typeof ImageObjectSchema>;
export type Image = z.infer<typeof ImageSchema>;

export const SourceSchema = z.enum(['internal', 'shopify']).describe('Fuente de los datos');

// Esquema fundamental que define la estructura mínima que toda fuente debe proporcionar
export const BaseProductSchema = z.object({
  id: z.string().describe('Identificador único del producto'),
  title: z.string().min(1).describe('Nombre del producto'),
  description: z.string().optional().describe('Descripción del producto'),
  source: SourceSchema,
});

// Esquema para precios que maneja la variabilidad entre sistemas
// Shopify puede tener rangos de precios complejos, mientras que el sistema interno tiene precios únicos
export const PriceRangeSchema = z.object({
  min: z.number().describe('Minimum price as number'),
  max: z.number().describe('Maximum price as number'),
  currency: CurrencySchema,
});

export const UnifiedVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number().positive(),
  available: z.boolean(),
  inventory_quantity: z.number().int().min(0).optional(),
  options: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
});

export const SyncStatus = z.enum(['synced', 'pending', 'error']);

// Complete product schema that combines all elements
export const UnifiedProductSchema = BaseProductSchema.extend({
  price_range: PriceRangeSchema,
  images: z.array(ImageObjectSchema).default([]),
  variants: z.array(UnifiedVariantSchema).min(1),

  // Campos opcionales que enriquecen la experiencia cuando están disponibles
  handle: z.string().optional(),
  product_type: z.string().optional(),
  vendor: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Metadatos técnicos para debugging y analytics
  source_metadata: z
    .object({
      last_updated: z.string().datetime().optional(),
      source_id: z.string().optional(),
      sync_status: SyncStatus.optional(),
    })
    .optional(),
});

// TypeScript infiere automáticamente el tipo correcto
export type UnifiedProduct = z.infer<typeof UnifiedProductSchema>;

const productSortKeys = ['updated', 'price', 'name'] as const;
export const ProductSearchParamsSchema = queryOf(
  z
    .object({
      category: z.string().max(100),
      price_min: z.coerce.number().min(0),
      price_max: z.coerce.number().min(0),
      available_only: z.coerce.boolean().default(true),
      vendor: z.string().max(100),
    })
    .partial(),
  productSortKeys,
);
export type ProductSearchParams = z.infer<typeof ProductSearchParamsSchema>;
export const ProductPageSchema = pageOf(UnifiedProductSchema).describe('Page of unified products');
export type ProductPage = z.infer<typeof ProductPageSchema>;

export type HealthStatus = {
  status: 'healthy' | 'warning' | 'error';
  lastCheck: Date;
  message?: string;
};

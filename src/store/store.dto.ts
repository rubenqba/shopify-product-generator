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

const productSortKeys = ['updated', 'name'] as const;
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

// creacion de productos
const toGid = (resource: 'Location' | 'Product' | 'Variant' | 'Collection' | 'File') =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? String(v) : String(v).trim()))
    .transform((v) => (v.startsWith('gid://shopify/') ? v : `gid://shopify/${resource}/${v}`))
    .refine(
      (v) => {
        // valida que terminó con un número (ajusta si tus IDs no siempre son numéricos)
        return /^gid:\/\/shopify\/[A-Za-z]+\/\d+$/.test(v);
      },
      { message: `ID ${resource} inválido. Usa un número o un GID válido.` },
    );

export const InventoryQuantitySchema = z.object({
  locationId: toGid('Location').describe('ID de la ubicación para el inventario.'),
  name: z.enum(['available', 'on_hand']),
  quantity: z.number().int().min(0),
});

export const VariantInventorySchema = z.object({
  tracked: z.boolean().default(true),
  cost: z.number().optional(),
  requiresShipping: z.boolean().default(true),
});

export const ProductOptionSchema = z.object({
  name: z.string(),
  values: z.array(
    z.object({
      name: z.string(),
    }),
  ),
});

export const ProductOptionValueSchema = z.object({
  optionName: z.string(),
  name: z.string(),
});

export const FileContentTypeSchema = z.enum(['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D', 'FILE']); // Admin GQL FileContentType

export const FileSetSchema = z
  .object({
    id: toGid('File').optional().describe('ID del archivo en Shopify si se va a reutilizar.'),
    originalSource: z.string().url().optional().describe('URL externa o staged upload'),
    alt: z.string().optional().describe('Texto alternativo para el archivo.'),
    contentType: FileContentTypeSchema.default('IMAGE').describe('Tipo de contenido del archivo.'),
  })
  .refine((f) => !!f.id || !!f.originalSource, {
    message: 'Debes proveer "id" o "originalSource" en cada file.',
  });

export const ProductVariantSchema = z
  .object({
    optionValues: ProductOptionValueSchema.array(),
    price: z.number().min(0),
    compareAtPrice: z.number().min(0).optional(),
    inventoryItem: VariantInventorySchema.optional(),
    inventoryQuantities: z.array(InventoryQuantitySchema).optional(),
    sku: z.string().trim().max(255).optional(),
    // 👇 archivo (imagen/video/3D) asociado a la variante (debe existir en product.files)
    file: FileSetSchema.optional(),
  })
  .refine((v) => v.compareAtPrice === undefined || v.compareAtPrice > v.price, {
    message: 'compareAtPrice debe ser mayor que price',
    path: ['compareAtPrice'],
  });

export const CreateProductSchema = z
  .object({
    title: z.string(),
    descriptionHtml: z.string().optional(),
    productType: z.string().optional(),
    vendor: z.string().optional(),
    productOptions: z.array(ProductOptionSchema).max(3).default([]),
    variants: z.array(ProductVariantSchema).max(100).default([]),
    // 👇 archivos a nivel producto (deben incluir cualquier file usado por variantes)
    files: z.array(FileSetSchema).default([]),
  })
  .refine(
    (data) => {
      if (data.variants.length > 0 && data.productOptions.length == 0) {
        return false;
      }
      const optionMap = Object.fromEntries(
        data.productOptions.map((opt) => [opt.name, new Set(opt.values.map((v) => v.name))]),
      );

      for (const variant of data.variants) {
        for (const ov of variant.optionValues) {
          if (!optionMap[ov.optionName]) return false;
          if (!optionMap[ov.optionName].has(ov.name)) return false;
        }
      }
      return true;
    },
    {
      message: 'Las opciones de los productos y las variantes no son consistentes',
      path: ['variants'],
    },
  )
  // ➕ añadimos superRefine para checks granulares extra:
  .superRefine((data, ctx) => {
    // 1) El file de cada variante debe existir también en product.files
    const ids = new Set(data.files.map((f) => f.id).filter(Boolean) as string[]);
    const srcs = new Set(data.files.map((f) => f.originalSource).filter(Boolean) as string[]);
    data.variants.forEach((v, i) => {
      if (!v.file) return;
      const ok = (v.file.id && ids.has(v.file.id)) || (v.file.originalSource && srcs.has(v.file.originalSource));
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', i, 'file'],
          message: 'La variante referencia un file que no está listado en input.files (requisito de Shopify).',
        });
      }
    });

    // 2) Si hay inventoryQuantities ⇒ inventoryItem.tracked debe ser true
    data.variants.forEach((v, i) => {
      if (v.inventoryQuantities?.length) {
        if (!v.inventoryItem?.tracked) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variants', i, 'inventoryItem', 'tracked'],
            message: 'Para enviar inventoryQuantities debes activar inventoryItem.tracked.',
          });
        }
        // 3) (Opcional) validar formato GID del locationId
        v.inventoryQuantities.forEach((iq, j) => {
          if (!/^gid:\/\/shopify\/Location\/\d+$/.test(iq.locationId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['variants', i, 'inventoryQuantities', j, 'locationId'],
              message: 'locationId debe ser un GID válido: gid://shopify/Location/<número>.',
            });
          }
        });
      }
    });

    // 4) (Opcional) evitar variantes duplicadas (misma combinación de optionValues)
    const seen = new Set<string>();
    data.variants.forEach((v, i) => {
      const key = JSON.stringify([...v.optionValues].sort((a, b) => a.optionName.localeCompare(b.optionName)));
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', i, 'optionValues'],
          message: 'Variantes duplicadas: misma combinación de opciones.',
        });
      } else {
        seen.add(key);
      }
    });
  });
export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean().default(false),
  fulfillOnlineOrders: z.boolean().default(false),
});
export type StoreLocation = z.infer<typeof LocationSchema>;

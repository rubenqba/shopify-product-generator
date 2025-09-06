export default () => ({
  port: parseInt(process.env.PORT ?? '5080', 10) || 5080,
  shopify: {
    key: process.env.SHOPIFY_API_KEY || '',
    secret: process.env.SHOPIFY_API_SECRET || '',
    shop: process.env.SHOPIFY_SHOP || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    host: process.env.SHOPIFY_HOST || 'localhost:5080',
    scope: process.env.SHOPIFY_SCOPE || 'write_products,read_locations',
  },
  unsplash: {
    access_key: process.env.UNSPLASH_ACCESS_KEY || '',
    secret_key: process.env.UNSPLASH_SECRET_KEY || '',
  },
});

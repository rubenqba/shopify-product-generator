# Instructions
Generate a JSON payload for creating a mock product in a Shopify store using available MCP tools and resources. The product category/type will be specified by the user (e.g., computer accessories, clothes and shoes, electronics, home tools, etc.), as well as an optional language preference. Product details must be in the specified language, defaulting to {language} if not provided. In addition to the core details, generate relevant product images using the `shopify-generate-product-images` tool and `shopify-generate-product-images-prompt`, and include these images in the appropriate places within the payload. Use the provided tools (`shopify-product-create`, `shopify-store-locations`, `shopify-generate-product-images`, `shopify-generate-product-images-prompt`) and the JSON schema shown below as references.

# Steps to Follow
1. Receive the product category/type from the user, and (optionally) a language preference.
2. Structure the product payload strictly according to the supplied JSON schema.
3. Populate all required properties (`title` and other relevant fields) with plausible values for the category, in the selected language (default: {language}).
4. For inventory locations, use the `shopify-store-locations` tool to select valid `locationId` values.
5. Generate a suitable English-language image query using `shopify-generate-product-images-prompt`, based on product category/type and details.
6. Use the `shopify-generate-product-images` tool to produce an array of image objects, following the provided image object schema.
7. Add these image objects:
   - In the `files` array at the root level of the product payload.
   - Optionally, assign relevant images to the `file` property in specific product `variants`.
8. Each image object must adhere strictly to the schema and match product context.
9. Output the final product payload in valid JSON format, following the full product JSON schema.

# Constraints
- Do not include actual API calls or function invocations; only generate the JSON payload.
- All properties and nested objects must match the JSON schema; do not add or omit any required schema fields.
- Product field values must be in the user-selected language (default: {language}); image queries, filenames, and alt text in English.
- Maximum: 3 product options, 5 variants, and 3–5 images unless otherwise specified.
- All data must be plausible and realistic for a Shopify store.

# Example
If the category is "Ropa y calzado" and no language is specified:

```json
{
  "title": "Zapatillas deportivas unisex",
  "descriptionHtml": "Zapatillas cómodas y ligeras ideales para correr y entrenar.",
  "productType": "Ropa y calzado",
  "vendor": "DeportePlus",
  "productOptions": [
    {
      "name": "Talla",
      "values": [
        {"name": "38"},
        {"name": "40"},
        {"name": "42"}
      ]
    },
    {
      "name": "Color",
      "values": [
        {"name": "Blanco"},
        {"name": "Negro"}
      ]
    }
  ],
  "variants": [
    {
      "optionValues": [
        {"optionName": "Talla", "name": "38"},
        {"optionName": "Color", "name": "Blanco"}
      ],
      "price": 59.99,
      "compareAtPrice": 79.99,
      "sku": "DP-ZAP-38-BL",
      "inventoryItem": {
        "tracked": true,
        "cost": 35.00,
        "requiresShipping": true
      },
      "inventoryQuantities": [
        {
          "locationId": "123456789",
          "name": "available",
          "quantity": 75
        }
      ],
      "file": {
        "id": "img_220",
        "originalSource": "https://images.example.com/uploads/shoe_white.jpg",
        "filename": "white_sport_shoe.jpg",
        "alt": "White unisex sport shoe",
        "contentType": "IMAGE"
      }
    }
    // More variants if needed
  ],
  "files": [
    {
      "id": "img_220",
      "originalSource": "https://images.example.com/uploads/shoe_white.jpg",
      "filename": "white_sport_shoe.jpg",
      "alt": "White unisex sport shoe",
      "contentType": "IMAGE"
    },
    {
      "id": "img_221",
      "originalSource": "https://images.example.com/uploads/shoe_black.jpg",
      "filename": "black_sport_shoe.jpg",
      "alt": "Black unisex sport shoe",
      "contentType": "IMAGE"
    },
    {
      "id": "img_222",
      "originalSource": "https://images.example.com/uploads/shoe_variation.jpg",
      "filename": "sport_shoe_variation.jpg",
      "alt": "Sport shoe with color variations",
      "contentType": "IMAGE"
    }
  ]
}
```

# Use Cases
- Helping agents and users generate complete Shopify mock product payloads, including images, covering multilingual and multiple product types.
- Automating product testing and demonstration flows with rich, schema-compliant product and image data.
- Enhancing MCP systems to support realistic multi-language and image-enriched product creation for Shopify.
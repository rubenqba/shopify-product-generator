# Instructions
Generate a JSON payload for creating a mock product in a Shopify store using available MCP tools and resources. The product category/type will be specified by the user (e.g., computer accessories, clothes and shoes, electronics, home tools, etc.), as well as an optional language preference. The product details should be in the specified language, defaulting to {language} if no language is provided. Use the provided tools (`shopify-store-create-product`, `shopify-store-locations`) and the given JSON schema as a reference for the payload structure.

# Steps to Follow
1. Receive the product category/type from the user, along with an optional language preference.
2. Structure the information according to the JSON payload schema detailed below.
3. Generate realistic and relevant values for each property, ensuring all product details are in the user-selected language (default: {language}).
4. For inventory locations, use available MCP resources (e.g., `shopify-resource-locations`) to select `locationId` values.
5. Ensure all required fields are present: `title`, and other fields as appropriate for the category and language.
6. Output the payload in valid JSON format, strictly following the schema.

# Constraints
- Do not include actual API calls or function tool invocations; only generate the JSON payload.
- Include only realistic mock data suitable for the specified product category/type.
- Use the specified language for all field values and descriptions, defaulting to {language} if not provided.
- Follow the schema strictly; do not add properties not defined in the schema.
- Use up to 3 product options and up to 5 variants if appropriate.
- All product information must be plausible for a Shopify store.

# Example
If the category is "Ropa y calzado" and no language is specified (default Spanish):

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
          "locationId": "gid://shopify/Location/123456789",
          "name": "available",
          "quantity": 75
        }
      ]
    }
    // ... more variants if needed
  ]
}
```

# Use Cases
- Assisting users and agents in generating structured mock data for product testing in Shopify stores, in different languages.
- Automating product creation flows for local or international development and demonstration scenarios.
- Integrating with MCP systems to streamline multi-language Shopify mock product provisioning.
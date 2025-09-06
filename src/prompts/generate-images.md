# Instructions
Generate a prompt to obtain product images for mock Shopify products using the MCP tool `shopify-generate-product-images`. The tool requires a `query` describing the type of images to generate (e.g., "widescreen monitors", "chocolate muffins"), and an optional `count` specifying the number of images desired (default: 3). The output should be an array of image objects formatted according to the provided schema, which can be reused with other tools such as `shopify-product-create`.

# Steps to Follow
1. Receive the product category/type or a specific image query from the user.
2. Formulate a suitable query string based on the provided product or image description.
3. Specify the number of images to generate (`count`), if indicated; otherwise, default to 3.
4. Ensure the resulting images match the description and are suitable for use with Shopify mock products.
5. Structure each returned image object using the following schema:

```json
{
  "id": "<string or number>",
  "originalSource": "<image_url>",
  "filename": "<file_name>",
  "alt": "<alternate_text>",
  "contentType": "IMAGE"
}
```

6. Each image object must be plausible and relevant to the query.

# Constraints
- Do not include actual API calls; only generate the appropriate prompt or query for the image generation tool.
- Image description (`query`) must be detailed enough to produce contextually relevant images based on the product category/type.
- Ensure all image objects strictly follow the provided schema.
- Default the number of images (`count`) to 3 if not specified by the user.
- Use English for all queries, filenames, and alternate text.

# Example
If the product category is "Sports Shoes," an appropriate image generation prompt and resulting JSON objects might be:

**Prompt/query for tool:**
`query: "modern sports shoes, isolated, white background", count: 3`

**Expected returned image objects:**
```json
[
  {
    "id": "img_102",
    "originalSource": "https://images.example.com/uploads/shoe1.jpg",
    "filename": "sports_shoe_white.jpg",
    "alt": "White modern sports shoe",
    "contentType": "IMAGE"
  },
  {
    "id": "img_103",
    "originalSource": "https://images.example.com/uploads/shoe2.jpg",
    "filename": "sports_shoe_black.jpg",
    "alt": "Black modern sports shoe",
    "contentType": "IMAGE"
  },
  {
    "id": "img_104",
    "originalSource": "https://images.example.com/uploads/shoe3.jpg",
    "filename": "sports_shoe_blue.jpg",
    "alt": "Blue modern sports shoe",
    "contentType": "IMAGE"
  }
]
```

# Use Cases
- Assisting agents with generating relevant product images for mock Shopify products, supporting automated payload creation.
- Enabling enhanced product presentations and richer payloads for development or demonstration environments.
- Facilitating multi-step workflows where images generated are reused in downstream product creation tools.
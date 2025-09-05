import { Injectable } from '@nestjs/common';
import { ShopifyService } from './shopify.service';
import { ProductSearchParams } from './store.dto';

@Injectable()
export class StoreService {
  constructor(private readonly shopify: ShopifyService) {}

  async checkHealth() {
    return this.shopify.checkHealth();
  }

  /**
   * Search for products in the store
   */
  async search(params: ProductSearchParams) {
    return this.shopify.search(params);
  }

  /**
   * Get details of a specific product by id
   */
  async productDetails() {}

  /**
   * Create a new product in the store
   */
  async createProduct() {}
}

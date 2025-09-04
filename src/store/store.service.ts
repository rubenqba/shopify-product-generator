import { Injectable } from '@nestjs/common';
import { ShopifyService } from './shopify.service';

@Injectable()
export class StoreService {

  constructor(private readonly shopify: ShopifyService) {}

  async checkHealth() {
    return this.shopify.checkHealth();
  }

  /**
   * Search for products in the store
   */
  async search() {}

  /**
   * Get details of a specific product by id
   */
  async productDetails() {}

  /**
   * Create a new product in the store
   */
  async createProduct() {}
}

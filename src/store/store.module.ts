import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { ShopifyStoreTool } from './store.tool';
import { ShopifyService } from './shopify.service';

@Module({
  providers: [ShopifyService, StoreService, ShopifyStoreTool],
})
export class StoreModule {}

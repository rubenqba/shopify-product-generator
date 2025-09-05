import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { ShopifyStoreTool } from './store.tool';
import { ShopifyService } from './shopify.service';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [CommonModule],
  providers: [ShopifyService, StoreService, ShopifyStoreTool],
})
export class StoreModule {}

import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { ShopifyStoreTool } from './store.tool';
import { ShopifyService } from './shopify.service';
import { CommonModule } from 'src/common/common.module';
import { UnsplashModule } from 'src/unsplash/unsplash.module';
import { StoreController } from './store.controller';

@Module({
  imports: [CommonModule, UnsplashModule],
  providers: [ShopifyService, StoreService, ShopifyStoreTool],
  controllers: [StoreController],
  exports: [ShopifyService],
})
export class StoreModule {}

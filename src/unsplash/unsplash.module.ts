import { Module } from '@nestjs/common';
import { UnsplashService } from './unsplash.service';
import { UnsplashController } from './unsplash.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [UnsplashService],
  controllers: [UnsplashController],
  exports: [UnsplashService],
})
export class UnsplashModule {}

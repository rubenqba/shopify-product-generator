import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HttpModule } from '@nestjs/axios';
import { StoreModule } from 'src/store/store.module';

@Module({
  imports: [TerminusModule, HttpModule, StoreModule],
  controllers: [HealthController],
})
export class HealthModule {}

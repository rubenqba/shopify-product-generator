import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthIndicatorResult } from '@nestjs/terminus';
import { ShopifyService } from 'src/store/shopify.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private store: ShopifyService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => ({ mcp: { status: 'up' } }), () => this.checkStore()]);
  }

  async checkStore(): Promise<HealthIndicatorResult> {
    return this.store
      .checkHealth()
      .then((status) => ({ store: { status: status.status === 'healthy' ? 'up' : 'down' } }));
  }
}

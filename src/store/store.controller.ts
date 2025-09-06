import { BadRequestException, Body, Controller, Get, Logger, Param, Post, UsePipes } from '@nestjs/common';
import { CreateProductSchema } from './store.dto';
import { ShopifyService } from './shopify.service';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';

class CreateProductDto extends createZodDto(CreateProductSchema) {}

@Controller('store')
export class StoreController {
  private readonly log = new Logger(StoreController.name);

  constructor(private readonly store: ShopifyService) {}

  @Post('')
  @UsePipes(ZodValidationPipe)
  async create(@Body() body: CreateProductDto) {
    try {
      return this.store.create(body);
    } catch (error) {
      // Handle error
      this.log.error('Error creating product:', error);
      throw new BadRequestException(error, 'Error creating product');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.store.findProduct(id);
  }
}

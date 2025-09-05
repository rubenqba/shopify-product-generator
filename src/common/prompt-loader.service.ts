import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PromptLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PromptLoaderService.name);
  private cache = new Map<string, string>();

  async onModuleInit() {
    // Carga adelantada opcional (siempre puedes cargar on-demand)
    await this.getPrompt('create-product.md').catch((e) =>
      this.logger.warn(`No se precargó el prompt: ${(e as Error)?.message}`),
    );
  }

  async getPrompt(fileName: string): Promise<string> {
    if (this.cache.has(fileName)) return this.cache.get(fileName)!;

    // __dirname aquí será, p.ej., dist/src/common en prod
    // Subimos a src/ y luego a prompts/
    const filePath = path.resolve(__dirname, '..', 'prompts', fileName);
    const content = await readFile(filePath, { encoding: 'utf8' });

    this.cache.set(fileName, content);
    return content;
  }
}

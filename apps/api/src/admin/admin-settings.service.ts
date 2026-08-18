import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Singleton — a migration 0008 já garante que essa linha existe. */
  private async getRow() {
    const row = await this.prisma.platformSettings.findFirst();
    if (!row) {
      throw new InternalServerErrorException('platform_settings sem linha — migration 0008 não rodou?');
    }
    return row;
  }

  async get() {
    return this.getRow();
  }

  async update(dto: UpdateSettingsDto) {
    const row = await this.getRow();
    return this.prisma.platformSettings.update({ where: { id: row.id }, data: dto });
  }
}

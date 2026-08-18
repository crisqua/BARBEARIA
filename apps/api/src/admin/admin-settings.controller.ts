import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** Configuração global do painel master — só Super Admin, sem tenant context. */
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  get() {
    return this.adminSettingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.adminSettingsService.update(dto);
  }
}

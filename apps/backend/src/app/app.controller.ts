import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

const isFrontendDisabled =
  process.env.SERVE_FRONTEND === 'false' ||
  process.env.DISABLE_STATIC_SERVING === 'true';

const redirectUrl = process.env.ROOT_REDIRECT_URL || 'https://heimspielradar.app';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData(@Res({ passthrough: true }) res?: Response) {
    if (isFrontendDisabled && res) {
      res.redirect(302, redirectUrl);

      return;
    }

    return this.appService.getData();
  }
}

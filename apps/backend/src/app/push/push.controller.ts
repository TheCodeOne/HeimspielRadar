import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RegisterPushReminderDto } from './dto/register-push-reminder.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.pushService.getVapidPublicKey();
  }

  @Post('reminders')
  @HttpCode(HttpStatus.CREATED)
  async registerReminder(@Body() dto: RegisterPushReminderDto) {
    return await this.pushService.registerReminder(dto);
  }

  @Delete('reminders/:matchId')
  @HttpCode(HttpStatus.OK)
  async deleteReminder(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Query('endpoint') queryEndpoint?: string,
    @Body('endpoint') bodyEndpoint?: string,
  ) {
    const endpoint = queryEndpoint || bodyEndpoint;

    return await this.pushService.deleteReminder(matchId, endpoint);
  }
}

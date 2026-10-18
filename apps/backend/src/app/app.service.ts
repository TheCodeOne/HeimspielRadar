import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@sundayleague/shared-types';

@Injectable()
export class AppService {
  getData(): ApiResponse {
    return { message: 'Hello from Sunday League API' };
  }
}

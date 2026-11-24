import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  service: string;
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return {
      service: 'auralis-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

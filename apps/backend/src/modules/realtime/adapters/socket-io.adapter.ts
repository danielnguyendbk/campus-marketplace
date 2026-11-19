import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

export class SocketIoAdapter extends IoAdapter {
  private readonly origins: string[];

  constructor(app: INestApplicationContext, corsOrigin = '*') {
    super(app);
    this.origins = corsOrigin.split(',').map((o) => o.trim());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIOServer(port: number, options?: any): any {
    const serverOptions = {
      ...options,
      path: '/ws',
      cors: {
        origin: this.origins.includes('*') ? '*' : this.origins,
        credentials: true,
      },
    };
    return super.createIOServer(port, serverOptions);
  }
}

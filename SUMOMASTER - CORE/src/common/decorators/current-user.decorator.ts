import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    return property ? user?.[property] : user;
  },
);

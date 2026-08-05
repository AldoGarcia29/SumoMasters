import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (property: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return property ? user?.[property] : user;
  },
);

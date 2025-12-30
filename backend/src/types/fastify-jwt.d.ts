import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      roles: {
        isExpert: boolean;
        isOrg: boolean;
        isAdmin: boolean;
      };
    };
    user: {
      id: string;
      roles: {
        isExpert: boolean;
        isOrg: boolean;
        isAdmin: boolean;
      };
    };
  }
}
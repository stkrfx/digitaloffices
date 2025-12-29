// shared/types.ts

// 1. ENUMS (Matches Prisma)
export enum UserRole {
    USER = 'USER',
    EXPERT = 'EXPERT',
    ADMIN = 'ADMIN',
    ORGANIZATION = 'ORGANIZATION'
  }
  
  // 2. REQUEST DTOs (Data Transfer Objects - What comes IN)
  
  export interface RegisterRequest {
    email: string;
    password?: string; // Optional because of Google Login
    name: string;      // Used to generate username/initials
    promotionalEmails?: boolean;
    initialRole?: UserRole; // User can choose to start as Expert directly?
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface GoogleSyncRequest {
    email: string;
    googleId: string;
    name: string;
    avatarUrl?: string;
  }
  
  // 3. RESPONSE DTOs (What goes OUT)
  
  export interface AuthResponse {
    message: string;
    user: {
      id: string;       // Account ID
      email: string;
      roles: {          // Which personas exist?
        isUser: boolean;
        isExpert: boolean;
        isAdmin: boolean;
        isOrg: boolean;
      };
      activePersona?: { // The profile data for the current context
        username: string;
        avatarUrl: string | null;
      }
    }
    // Tokens are NOT here. They are in HttpOnly Cookies.
  }
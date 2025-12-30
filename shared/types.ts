// shared/types.ts

// 1. ENUMS (Matching your Database Logic)
export type UserRole = 'USER' | 'EXPERT' | 'ORGANIZATION' | 'ADMIN';

export enum ServiceType {
  VIDEO_CALL = 'VIDEO_CALL',
  IN_PERSON_VISIT = 'IN_PERSON_VISIT'
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

// 2. AUTH REQUESTS (Inputs)
export interface RegisterRequest {
  email: string;
  password?: string; // Optional for Google Auth users
  name: string;      // "John Doe"

  // Marketing Preferences
  promotionalEmails?: boolean;

  // Does the user want to be an Expert immediately?
  initialRole?: 'USER' | 'EXPERT' | 'ORGANIZATION';
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

// 3. CORE DTOs (Outputs)

// The "Safe" User object sent to Frontend
export interface UserDto {
  id: string;
  username: string; // @mindnamo_user
  email: string;
  name: string;
  avatarUrl: string | null;

  // Computed Flags (Frontend uses these to show/hide Sidebar items)
  roles: {
    isExpert: boolean;
    isOrganization: boolean;
    isAdmin: boolean;
  };

  preferences: {
    theme: string;
    notifications: boolean;
  };
}

// The Response when Auth succeeds
export interface AuthResponse {
  message: string;
  user: UserDto;
  // NOTE: Tokens (Access/Refresh) are NOT sent in JSON.
  // They are sent as HttpOnly Cookies for security.
}

// 4. FEATURE DTOs (For future use)

export interface ServiceDto {
  id: string;
  title: string;
  price: number;
  durationMin: number;
  type: ServiceType;
}

export interface BookingDto {
  id: string;
  startTime: string; // ISO Date String
  status: BookingStatus;
  service: ServiceDto;
  expert: {
    name: string;
    headline: string;
  };
}

// New Request DTO for verification
export interface VerifyEmailRequest {
  token: string;
}

export interface AvailabilityDto {
  dayOfWeek: number; // 0-6
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  isActive: boolean;
}
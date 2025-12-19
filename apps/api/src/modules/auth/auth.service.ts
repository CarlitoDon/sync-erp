import { User, Session } from '@sync-erp/database';
import { RegisterPayload, LoginPayload } from '@sync-erp/shared';
import { AuthRepository } from './auth.repository';
import { UserService } from '../user/user.service';
import { hashPassword, comparePassword } from './auth.utils';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: {
    code: string;
    message: string;
  };
}

export class AuthService {
  private repository = new AuthRepository();
  private userService = new UserService();

  async register(payload: RegisterPayload): Promise<AuthResult> {
    const { email, password, name } = payload;

    // Check if user exists
    const existingUser = await this.userService.getByEmail(email);
    if (existingUser) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Email already exists' },
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.userService.create({
      email,
      name,
      passwordHash: hashedPassword,
    });

    // Create session (auto-login)
    const session = await this.repository.createSession(user.id);

    return {
      success: true,
      user,
      session,
    };
  }

  async login(payload: LoginPayload): Promise<AuthResult> {
    const { email, password } = payload;

    const user = await this.userService.getByEmail(email);
    if (!user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      };
    }

    const isValid = await comparePassword(
      password,
      user.passwordHash
    );
    if (!isValid) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      };
    }

    const session = await this.repository.createSession(user.id);

    return {
      success: true,
      user,
      session,
    };
  }

  async logout(sessionId: string) {
    return this.repository.deleteSession(sessionId);
  }

  async getSession(sessionId: string) {
    return this.repository.getSession(sessionId);
  }
  async getProfile(userId: string): Promise<User | null> {
    return this.userService.getById(userId);
  }
}

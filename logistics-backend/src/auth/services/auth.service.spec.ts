import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Repository } from 'typeorm';
import { User, Role } from '../../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../users/services/users.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: Repository<User>;
  let jwtService: JwtService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mock-jwt-token'),
          },
        },
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
        {
          provide: UsersService,
          useValue: {
            getUserByUsernameWithPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'hashed-password',
        role: Role.USER,
      };
      jest
        .spyOn(usersService, 'getUserByUsernameWithPassword')
        .mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser('testuser', 'password');

      expect(usersService.getUserByUsernameWithPassword).toHaveBeenCalledWith(
        'testuser',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password',
        'hashed-password',
      );
      const { password, ...expectedResult } = mockUser;
      expect(result).toEqual(expectedResult);
    });

    it('should return null if user not found', async () => {
      jest
        .spyOn(usersService, 'getUserByUsernameWithPassword')
        .mockRejectedValue(new Error('User not found'));

      const result = await authService.validateUser('nonexistent', 'password');

      expect(usersService.getUserByUsernameWithPassword).toHaveBeenCalledWith(
        'nonexistent',
      );
      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'hashed-password',
        role: Role.USER,
      };
      jest
        .spyOn(usersService, 'getUserByUsernameWithPassword')
        .mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(
        'testuser',
        'wrongpassword',
      );

      expect(usersService.getUserByUsernameWithPassword).toHaveBeenCalledWith(
        'testuser',
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return JWT token and user data', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: Role.USER,
      };

      const result = await authService.login(mockUser as User);

      expect(jwtService.sign).toHaveBeenCalledWith({
        username: 'testuser',
        role: Role.USER,
        sub: 1,
      });
      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: Role.USER,
        },
      });
    });
  });

  describe('register', () => {
    it('should create a new user with default role USER', async () => {
      const mockUser = {
        id: 1,
        username: 'newuser',
        password: 'hashed-password',
        email: 'new@example.com',
        role: Role.USER,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      jest.spyOn(usersRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser as User);

      const result = await authService.register(
        'newuser',
        'password',
        'new@example.com',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);
      expect(usersRepository.create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'hashed-password',
        email: 'new@example.com',
        role: Role.USER,
      });
      expect(usersRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        role: Role.USER,
      });
    });

    it('should create a new user with specified role', async () => {
      const mockUser = {
        id: 1,
        username: 'adminuser',
        password: 'hashed-password',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      jest.spyOn(usersRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser as User);

      const result = await authService.register(
        'adminuser',
        'password',
        'admin@example.com',
        Role.ADMIN,
      );

      expect(usersRepository.create).toHaveBeenCalledWith({
        username: 'adminuser',
        password: 'hashed-password',
        email: 'admin@example.com',
        role: Role.ADMIN,
      });
      expect(result.role).toBe(Role.ADMIN);
    });
  });

  describe('findUserByUsername', () => {
    it('should return user by username', async () => {
      const mockUser = { id: 1, username: 'testuser', role: Role.USER };
      jest
        .spyOn(usersRepository, 'findOne')
        .mockResolvedValue(mockUser as User);

      const result = await authService.findUserByUsername('testuser');

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      const result = await authService.findUserByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });
});

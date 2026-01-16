const request = require('supertest');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../logistics-backend/src/app.module');
const { getConnection } = require('typeorm');

describe('Authentication API Integration Test', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    // Create the NestJS application
    app = await NestFactory.create(AppModule);
    // Enable CORS
    app.enableCors({
      origin: 'http://localhost:3000',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });
    server = await app.listen(process.env.PORT || 3001);
  });

  afterAll(async () => {
    await server.close();
    await getConnection().close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const testUsername = `testuser_${Date.now()}`;
      const newUser = {
        username: testUsername,
        email: `${testUsername}@example.com`,
        password: 'password123',
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.username).toBe(testUsername);
      expect(response.body.data.user.email).toBe(`${testUsername}@example.com`);
      expect(response.body.data.user.role).toBe('USER'); // Default role should be USER
    });

    it('should fail to register with duplicate username', async () => {
      const newUser = {
        username: 'admin', // Admin user already exists
        email: 'newemail@example.com',
        password: 'password123',
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Username already exists');
    });

    it('should fail to register with invalid email', async () => {
      const newUser = {
        username: `testuser_${Date.now()}`,
        email: 'invalid-email', // Invalid email format
        password: 'password123',
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('user');
      expect(loginResponse.body.data).toHaveProperty('access_token');
      expect(loginResponse.body.data.user.username).toBe('admin');
      expect(loginResponse.body.data.user.role).toBe('ADMIN');
    });

    it('should fail to login with invalid credentials', async () => {
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.message).toContain('Invalid username or password');
    });

    it('should fail to login with non-existent username', async () => {
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'password',
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.message).toContain('Invalid username or password');
    });

    it('should fail to login with empty credentials', async () => {
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: '',
          password: '',
        });

      expect(loginResponse.status).toBe(400);
      expect(loginResponse.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user information when authenticated', async () => {
      // First login to get token
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        });

      const token = loginResponse.body.data.access_token;

      // Then get current user info
      const meResponse = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data).toHaveProperty('id');
      expect(meResponse.body.data.username).toBe('admin');
      expect(meResponse.body.data.role).toBe('ADMIN');
    });

    it('should fail to get user info without token', async () => {
      const meResponse = await request(server)
        .get('/api/auth/me');

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.message).toContain('Unauthorized');
    });

    it('should fail to get user info with invalid token', async () => {
      const meResponse = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(meResponse.status).toBe(401);
      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.message).toContain('Unauthorized');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // First login to get token
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        });

      const token = loginResponse.body.data.access_token;

      // Then logout
      const logoutResponse = await request(server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toContain('Logout successful');
    });
  });
});

const request = require('supertest');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../logistics-backend/src/app.module');
const { getConnection } = require('typeorm');

describe('Orders API Integration Test', () => {
  let app;
  let server;
  let token;

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

    // Login to get JWT token
    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'password',
      });

    token = loginResponse.body.data.access_token;
  });

  afterAll(async () => {
    await server.close();
    await getConnection().close();
  });

  describe('GET /api/orders', () => {
    it('should return orders with pagination', async () => {
      const response = await request(server)
        .get('/api/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.orders)).toBe(true);
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const newOrder = {
        order_number: `TEST${Date.now()}`,
        customer_name: 'Test Customer',
        department_key: 'DEP001',
        status: 'PENDING',
      };

      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(newOrder);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.order).toHaveProperty('id');
      expect(response.body.data.order.order_number).toBe(newOrder.order_number);
      expect(response.body.data.order.customer_name).toBe(newOrder.customer_name);
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('should update an existing order', async () => {
      // First, create an order
      const newOrder = {
        order_number: `TEST${Date.now()}`,
        customer_name: 'Test Customer',
        department_key: 'DEP001',
        status: 'PENDING',
      };

      const createResponse = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(newOrder);

      const orderId = createResponse.body.data.order.id;

      // Then, update the order
      const updatedOrder = {
        status: 'SHIPPED',
        customer_name: 'Updated Customer',
      };

      const updateResponse = await request(server)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedOrder);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.order.id).toBe(orderId);
      expect(updateResponse.body.data.order.status).toBe(updatedOrder.status);
      expect(updateResponse.body.data.order.customer_name).toBe(updatedOrder.customer_name);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should delete an existing order', async () => {
      // First, create an order
      const newOrder = {
        order_number: `TEST${Date.now()}`,
        customer_name: 'Test Customer',
        department_key: 'DEP001',
        status: 'PENDING',
      };

      const createResponse = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(newOrder);

      const orderId = createResponse.body.data.order.id;

      // Then, delete the order
      const deleteResponse = await request(server)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // Verify the order was deleted
      const getResponse = await request(server)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getResponse.status).toBe(404);
    });
  });
});

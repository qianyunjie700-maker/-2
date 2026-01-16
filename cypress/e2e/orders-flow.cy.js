// Order Flow E2E Test

describe('Order Flow Test', () => {
  const testOrder = {
    order_number: `TEST${Date.now()}`,
    customer_name: 'E2E Test Customer',
    department_key: 'DEP001',
    status: 'PENDING',
  };

  it('should login with admin credentials', () => {
    cy.login('admin', 'password');
  });

  it('should navigate to orders page', () => {
    cy.visit('/orders');
    cy.contains('订单管理').should('be.visible');
  });

  it('should create a new order', () => {
    cy.createOrder(testOrder);
  });

  it('should search for the created order', () => {
    cy.searchOrders(testOrder.order_number);
  });

  it('should view order details', () => {
    cy.contains(testOrder.order_number).should('be.visible').click();
    cy.url().should('include', '/orders/');
    cy.contains(testOrder.customer_name).should('be.visible');
  });

  it('should update order status', () => {
    // Get order ID from URL
    cy.url().then((url) => {
      const orderId = url.split('/').pop();
      cy.updateOrderStatus(orderId, 'IN_TRANSIT');
      cy.contains('运输中').should('be.visible');
    });
  });

  it('should update order status to delivered', () => {
    // Get order ID from URL
    cy.url().then((url) => {
      const orderId = url.split('/').pop();
      cy.updateOrderStatus(orderId, 'DELIVERED');
      cy.contains('已完成').should('be.visible');
    });
  });

  it('should logout successfully', () => {
    cy.logout();
  });
});

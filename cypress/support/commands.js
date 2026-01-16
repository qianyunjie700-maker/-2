// Cypress Custom Commands

// Login command
Cypress.Commands.add('login', (username = 'admin', password = 'password') => {
  cy.visit('/login');
  cy.get('input[name="username"]').should('be.visible').type(username);
  cy.get('input[name="password"]').should('be.visible').type(password);
  cy.get('button[type="submit"]').should('be.visible').click();
  // Wait for dashboard to load
  cy.contains('总控看板', { timeout: 10000 }).should('be.visible');
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('div[class*="user-menu"]').should('be.visible').click();
  cy.contains('退出登录').should('be.visible').click();
  // Wait for login page to load
  cy.contains('登录', { timeout: 5000 }).should('be.visible');
});

// Create order command
Cypress.Commands.add('createOrder', (orderData) => {
  cy.visit('/orders');
  cy.contains('创建订单').should('be.visible').click();
  
  // Fill in the order form
  cy.get('input[name="order_number"]').should('be.visible').type(orderData.order_number);
  cy.get('input[name="customer_name"]').should('be.visible').type(orderData.customer_name);
  cy.get('input[name="department_key"]').should('be.visible').type(orderData.department_key);
  cy.get('select[name="status"]').should('be.visible').select(orderData.status);
  
  cy.get('button[type="submit"]').should('be.visible').click();
  
  // Verify order was created
  cy.contains('订单创建成功', { timeout: 5000 }).should('be.visible');
});

// Update order status command
Cypress.Commands.add('updateOrderStatus', (orderId, newStatus) => {
  cy.visit(`/orders/${orderId}`);
  cy.contains('更新状态').should('be.visible').click();
  cy.get('select[name="status"]').should('be.visible').select(newStatus);
  cy.contains('确认').should('be.visible').click();
  
  // Verify status was updated
  cy.contains('订单状态更新成功', { timeout: 5000 }).should('be.visible');
});

// Search orders command
Cypress.Commands.add('searchOrders', (searchTerm) => {
  cy.visit('/orders');
  cy.get('input[placeholder="搜索订单编号或客户名称"]').should('be.visible').type(searchTerm);
  cy.get('button[type="submit"]').should('be.visible').click();
  
  // Verify search results
  cy.contains(searchTerm, { timeout: 5000 }).should('be.visible');
});

// Check responsive layout command
Cypress.Commands.add('checkResponsiveLayout', () => {
  // Check mobile view
  cy.viewport(375, 667);
  cy.get('button[aria-label="menu-button"]').should('be.visible').click();
  cy.contains('总控看板').should('be.visible');
  cy.contains('业务明细').should('be.visible');
  
  // Check tablet view
  cy.viewport(768, 1024);
  cy.get('div[class*="sidebar"]').should('be.visible');
  
  // Check desktop view
  cy.viewport(1280, 720);
  cy.get('div[class*="sidebar"]').should('be.visible');
  cy.get('div[class*="main-content"]').should('be.visible');
});

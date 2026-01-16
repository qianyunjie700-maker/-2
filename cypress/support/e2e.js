// Cypress E2E Support File

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global configuration before each test
beforeEach(() => {
  // Reset local storage before each test
  cy.clearLocalStorage();
  // Reset cookies before each test
  cy.clearCookies();
});

// Custom commands for common actions
Cypress.Commands.add('login', (username, password) => {
  cy.visit('/login');
  cy.get('input[name="username"]').type(username);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  // Wait for navigation to dashboard
  cy.url().should('include', '/');
});

Cypress.Commands.add('logout', () => {
  cy.get('button[aria-label="user-menu-button"]').click();
  cy.contains('退出登录').click();
  // Wait for navigation to login page
  cy.url().should('include', '/login');
});

Cypress.Commands.add('createOrder', (orderData) => {
  cy.visit('/orders');
  cy.contains('创建订单').click();
  
  // Fill in order form
  cy.get('input[name="order_number"]').type(orderData.order_number);
  cy.get('input[name="customer_name"]').type(orderData.customer_name);
  cy.get('input[name="department_key"]').type(orderData.department_key);
  cy.get('select[name="status"]').select(orderData.status);
  
  cy.get('button[type="submit"]').click();
  
  // Wait for success message
  cy.contains('订单创建成功');
});

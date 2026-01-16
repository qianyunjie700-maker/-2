// Responsive Layout E2E Test

describe('Responsive Layout Test', () => {
  before(() => {
    cy.login('admin', 'password');
  });

  after(() => {
    cy.logout();
  });

  it('should display mobile layout on small screens', () => {
    // Set viewport to mobile size
    cy.viewport(375, 667);

    // Check if mobile menu button is visible
    cy.get('button[aria-label="menu-button"]').should('be.visible');

    // Check if sidebar is hidden by default
    cy.get('div[class*="sidebar"]').should('not.be.visible');

    // Open mobile menu
    cy.get('button[aria-label="menu-button"]').click();

    // Check if navigation items are visible in mobile menu
    cy.contains('总控看板').should('be.visible');
    cy.contains('业务明细').should('be.visible');
    cy.contains('数据中台').should('be.visible');

    // Close mobile menu
    cy.get('button[aria-label="close-menu"]').click();
    cy.get('div[class*="sidebar"]').should('not.be.visible');
  });

  it('should display tablet layout on medium screens', () => {
    // Set viewport to tablet size
    cy.viewport(768, 1024);

    // Check if sidebar is visible
    cy.get('div[class*="sidebar"]').should('be.visible');

    // Check if navigation items are visible
    cy.contains('总控看板').should('be.visible');
    cy.contains('业务明细').should('be.visible');

    // Check if main content is properly aligned
    cy.get('div[class*="main-content"]').should('be.visible');
  });

  it('should display desktop layout on large screens', () => {
    // Set viewport to desktop size
    cy.viewport(1280, 720);

    // Check if sidebar is expanded
    cy.get('div[class*="sidebar"]').should('have.class', 'w-64');

    // Check if navigation items are clearly visible
    cy.contains('总控看板').should('be.visible');
    cy.contains('业务明细').should('be.visible');
    cy.contains('数据中台').should('be.visible');
    cy.contains('个人信息').should('be.visible');

    // Check if main content has proper width
    cy.get('div[class*="main-content"]').should('have.class', 'ml-64');
  });

  it('should handle menu toggle on tablet and desktop', () => {
    // Set viewport to desktop size
    cy.viewport(1280, 720);

    // Toggle sidebar
    cy.get('button[aria-label="toggle-sidebar"]').click();

    // Check if sidebar is collapsed
    cy.get('div[class*="sidebar"]').should('have.class', 'w-20');

    // Check if main content adjusts
    cy.get('div[class*="main-content"]').should('have.class', 'ml-20');

    // Toggle sidebar back
    cy.get('button[aria-label="toggle-sidebar"]').click();
    cy.get('div[class*="sidebar"]').should('have.class', 'w-64');
  });

  it('should have responsive dashboard cards', () => {
    // Check mobile view
    cy.viewport(375, 667);
    cy.visit('/');
    
    // Dashboard cards should be stacked
    cy.get('div[class*="stat-card"]').should('have.class', 'w-full');

    // Check tablet view
    cy.viewport(768, 1024);
    
    // Dashboard cards should be in rows of 2
    cy.get('div[class*="stat-card"]').should('have.class', 'w-1/2');

    // Check desktop view
    cy.viewport(1280, 720);
    
    // Dashboard cards should be in rows of 4
    cy.get('div[class*="stat-card"]').should('have.class', 'w-1/4');
  });

  it('should have responsive table layout', () => {
    // Check mobile view
    cy.viewport(375, 667);
    cy.visit('/orders');
    
    // Table should have horizontal scroll on mobile
    cy.get('div[class*="table-container"]').should('have.class', 'overflow-x-auto');

    // Check desktop view
    cy.viewport(1280, 720);
    
    // Table should be fully visible on desktop
    cy.get('div[class*="table-container"]').should('not.have.class', 'overflow-x-auto');
  });

  it('should have responsive form elements', () => {
    // Check mobile view
    cy.viewport(375, 667);
    cy.visit('/orders/create');
    
    // Form inputs should be full width on mobile
    cy.get('input[type="text"]').should('have.class', 'w-full');
    cy.get('select').should('have.class', 'w-full');

    // Check desktop view
    cy.viewport(1280, 720);
    
    // Form inputs should have proper width on desktop
    cy.get('input[type="text"]').should('not.have.class', 'w-full');
    cy.get('select').should('not.have.class', 'w-full');
  });
});

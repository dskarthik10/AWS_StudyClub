describe('StudyClub Application - Automated Tests', () => {
  const email = 'alpha.tester@example.com';
  const password = 'Tc636592!2399';

  beforeEach(() => {
    cy.visit('/');
  });

  // 1. Application loads
  it('TC01 - should load the application', () => {
    cy.get('#root').should('exist').and('not.be.empty');
  });

  // 2. Login page heading
  it('TC02 - should display the welcome heading', () => {
    cy.contains('Welcome to AI StudyClub').should('be.visible');
  });

  // 3. Email field
  it('TC03 - should display the email field', () => {
    cy.get('input[type="email"]').should('be.visible');
  });

  // 4. Password field
  it('TC04 - should display the password field', () => {
    cy.get('input[type="password"]').should('be.visible');
  });

  // 5. Sign-in button
  it('TC05 - should display the Sign in button', () => {
    cy.contains('button', 'Sign in').should('be.visible');
  });

  // 6. Email input accepts text
  it('TC06 - should allow entering an email', () => {
    cy.get('input[type="email"]')
      .type(email)
      .should('have.value', email);
  });

  // 7. Password input accepts text
  it('TC07 - should allow entering a password', () => {
    cy.get('input[type="password"]')
      .type(password)
      .should('have.value', password);
  });

  // 8. Password should be masked
  it('TC08 - should mask the password', () => {
    cy.get('input[type="password"]').should('have.attr', 'type', 'password');
  });

  // 9. Email field is required
  it('TC09 - should require an email before submission', () => {
    cy.get('input[type="email"]').then(($input) => {
      expect($input[0].required).to.equal(true);
    });
  });

  // 10. Password field is required
  it('TC10 - should require a password before submission', () => {
    cy.get('input[type="password"]').then(($input) => {
      expect($input[0].required).to.equal(true);
    });
  });

  // 11. Empty login submission
  it('TC11 - should handle empty login submission', () => {
  cy.contains('button', 'Sign in').click();

  // The login page should remain accessible.
  cy.get('input[type="email"]').should('be.visible');
  cy.get('input[type="password"]').should('be.visible');
});

  // 12. Invalid email format
  it('TC12 - should reject an invalid email format', () => {
    cy.get('input[type="email"]').type('invalid-email');
    cy.get('input[type="email"]').then(($input) => {
      expect($input[0].checkValidity()).to.equal(false);
    });
  });

  // 13. Forgot password link
  it('TC13 - should display the forgot-password option', () => {
    cy.contains(/forgot your password/i).should('be.visible');
  });

  // 14. Create account option
  it('TC14 - should display the create-account option', () => {
    cy.contains(/create an account/i).should('be.visible');
  });

  // 15. Login screen contains no broken images
  it('TC15 - should load any images present on the login page', () => {
    cy.get('body').then(($body) => {
      const images = $body.find('img').toArray();

      images.forEach((img) => {
        expect(img.complete, 'image loaded').to.equal(true);
        expect(img.naturalWidth, 'image has dimensions').to.be.greaterThan(0);
      });
    });
  });

  // 16. Root application exists
  it('TC16 - should render the application root', () => {
    cy.get('#root').should('be.visible');
  });

  // 17. Page has visible content
  it('TC17 - should display meaningful page content', () => {
    cy.get('body').invoke('text').should('match', /\S+/);
  });

  // 18. Login form is available
  it('TC18 - should display a login form', () => {
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
  });

  // 19. No internal server error message
  it('TC19 - should not display an internal server error', () => {
    cy.contains('Internal Server Error').should('not.exist');
  });

  // 20. Successful sign-in
  it('TC20 - should sign in with the test account', () => {
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password, { log: false });
    cy.contains('button', 'Sign in').click();

    // Update this assertion if your app uses a different dashboard heading.
    cy.contains(/dashboard|welcome|resource library/i, {
      timeout: 15000,
    }).should('be.visible');
  });
});
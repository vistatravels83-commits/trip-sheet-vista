
describe('Driver Form', () => {
    beforeEach(() => {
        cy.visit('/');
        // Mock Supabase calls if necessary, or rely on live/dev database if configured. 
        // For this E2E, we'll assume the app is running and connected.
        // Ideally we should intercept network requests to avoid polluting DB.

        // Intercept Supabase calls
        cy.intercept('GET', '**/rest/v1/companies*', {
            statusCode: 200,
            body: [{ name: 'Test Company A' }, { name: 'Test Company B' }]
        }).as('getCompanies');

        cy.intercept('GET', '**/rest/v1/car_types*', {
            statusCode: 200,
            body: [{ name: 'Test Sedan' }, { name: 'Test SUV' }]
        }).as('getCarTypes');

        cy.intercept('POST', '**/rest/v1/trips', {
            statusCode: 201,
            body: []
        }).as('saveTrip');
    });

    it('loads the form and shows online status', () => {
        // Check for the Agency Name in header
        cy.contains('Vista Travels').should('be.visible');
        // Check for Online status (assuming we are online)
        cy.contains('Online').should('be.visible');
    });

    it('validates required fields', () => {
        cy.contains('button', 'Submit Trip Sheet').click();
        // Signature is required
        cy.contains('Signature is required to submit').should('be.visible');
    });

    it('fills out the form and submits', () => {
        // Fill text inputs
        cy.get('input[placeholder="Select or enter company"]').type('Test Company A');
        cy.get('input[placeholder="Client Name"]').type('John Doe');
        cy.get('input[placeholder="Guest Name"]').type('Jane Doe');

        // Selects
        cy.get('select').eq(0).select('Test Sedan'); // Car Type
        cy.get('select').eq(1).select('One way'); // Trip Type

        // Route
        cy.get('input[placeholder="Source"]').type('Chennai');
        cy.get('input[placeholder="Destination"]').type('Bangalore');
        cy.get('input[placeholder="TN-00-AA-0000"]').type('TN-99-XX-9999');

        // KM
        cy.get('input[placeholder="0"]').eq(0).type('100'); // Start KM
        cy.get('input[placeholder="0"]').eq(1).type('250'); // End KM

        // Verify total calculation
        cy.contains('150 km').should('be.visible');

        // Sign the canvas
        cy.get('canvas').then($canvas => {
            const canvas = $canvas[0];
            const ctx = canvas.getContext('2d');
            const { width, height } = canvas;
            ctx.beginPath();
            ctx.moveTo(width / 4, height / 4);
            ctx.lineTo(width * 3 / 4, height * 3 / 4);
            ctx.stroke();
            // Trigger events to notify signature pad
            $canvas.dispatchEvent(new Event('mousedown'));
            $canvas.dispatchEvent(new Event('mouseup'));
        });

        // Submit
        cy.contains('button', 'Submit Trip Sheet').click();

        // Verify success message
        cy.wait('@saveTrip');
        cy.contains('Trip sheet submitted successfully!').should('be.visible');
    });
});

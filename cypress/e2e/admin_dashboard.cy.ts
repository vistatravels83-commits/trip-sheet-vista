
describe('Admin Dashboard', () => {
    beforeEach(() => {
        // Intercept data fetching
        cy.intercept('GET', '**/rest/v1/trips*', {
            statusCode: 200,
            body: [
                {
                    id: '123',
                    // Supabase returns snake_case
                    trip_id: '101',
                    company_name: 'Test Corp',
                    booked_by: 'Alice',
                    vehicle_reg_no: 'TN-01-AB-1234',
                    start_km: 1000,
                    end_km: 1050,
                    total_km: 50,
                    created_at: new Date().toISOString()
                }
            ]
        }).as('getTrips');

        cy.visit('/#/admin');
    });

    it('accesses admin dashboard', () => {
        cy.get('h1').contains('Dashboard').should('be.visible');
        cy.contains('Administration').should('be.visible');
    });

    it('displays fetched trips', () => {
        cy.wait('@getTrips');
        cy.contains('Test Corp').should('be.visible');
        cy.contains('Alice').should('be.visible');
        cy.contains('TN-01-AB-1234').should('be.visible');
    });

    it('navigates tabs', () => {
        cy.contains('button', 'Companies').click();
        cy.contains('h2', 'Companies').should('be.visible');

        cy.contains('button', 'Car Types').click();
        cy.contains('h2', 'Car Types').should('be.visible');

        cy.contains('button', 'Settings').click();
        cy.contains('h2', 'App Settings').should('be.visible');
    });
});

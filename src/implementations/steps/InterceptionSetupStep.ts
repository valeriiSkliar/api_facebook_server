export class InterceptionSetupStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    await context.state.page.setRequestInterception(true);

    context.state.page.on('request', (request) => {
      request.continue();
    });

    context.state.page.on('response', async (response) => {
      const url = response.url();

      // Only process GraphQL API responses
      if (
        url.includes('facebook.com/api/graphql/') &&
        response.request().method() === 'POST'
      ) {
        try {
          const responseText = await response.text();

          if (
            responseText.includes('ad_library_main') &&
            responseText.includes('search_results_connection')
          ) {
            // Extract ad data
            const adData = this.extractAdData(responseText);
            context.state.adsCollected.push(...adData);

            this.logger.info(
              `Total ads collected: ${context.state.adsCollected.length}`,
            );
          }
        } catch (error) {
          this.logger.error('Error processing response', error);
          context.state.errors.push(error as Error);
        }
      }
    });
  }

  private extractAdData(responseText: string): AdData[] {
    // Extract and format ad data from response
    // ...implementation here...
  }
}

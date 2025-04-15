// src/scrapers/facebook/steps/facebook-scraper-step.ts

import { AbstractGenericScraperStep } from '@src/scrapers/common/interfaces/abstract-generic-scraper-step';
import { FacebookScraperContext } from '../facebook-scraper-types';

/**
 * Base class for all Facebook scraper steps
 */
export abstract class FacebookScraperStep extends AbstractGenericScraperStep<FacebookScraperContext> {}

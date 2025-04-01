// src/services/browser-pool/browser-metrics-service.ts

import { Injectable, Logger } from '@nestjs/common';
import { BrowserInstance, BrowserState } from './types';

/**
 * Service for tracking and reporting browser pool metrics
 */
@Injectable()
export class BrowserMetricsService {
  private readonly logger = new Logger(BrowserMetricsService.name);

  // Metrics storage
  private readonly metrics = {
    created: 0,
    closed: 0,
    errors: 0,
    requestsServed: 0,
    avgCreationTime: 0,
    peakPoolSize: 0,
    stateDistribution: {
      [BrowserState.AVAILABLE]: 0,
      [BrowserState.IN_USE]: 0,
      [BrowserState.CLOSING]: 0,
    },
    reuse: {
      reuseCount: 0,
      totalCreated: 0,
    },
  };

  // Track creation times for averaging
  private creationTimes: number[] = [];

  /**
   * Record a browser creation event
   * @param creationTime - Time in ms it took to create the browser
   */
  recordBrowserCreation(creationTime: number): void {
    this.metrics.created++;
    this.creationTimes.push(creationTime);

    // Update average creation time
    const total = this.creationTimes.reduce((sum, time) => sum + time, 0);
    this.metrics.avgCreationTime = total / this.creationTimes.length;

    this.metrics.reuse.totalCreated++;
  }

  /**
   * Record a browser closure event
   */
  recordBrowserClosure(): void {
    this.metrics.closed++;
  }

  /**
   * Record an error event
   */
  recordError(): void {
    this.metrics.errors++;
  }

  /**
   * Record a request served by a browser
   */
  recordRequestServed(): void {
    this.metrics.requestsServed++;
  }

  /**
   * Record a browser reuse event
   */
  recordBrowserReuse(): void {
    this.metrics.reuse.reuseCount++;
  }

  /**
   * Update browser state distribution metrics
   * @param browsers - List of all browsers in the pool
   */
  updateStateDistribution(browsers: BrowserInstance[]): void {
    // Reset counts
    this.metrics.stateDistribution = {
      [BrowserState.AVAILABLE]: 0,
      [BrowserState.IN_USE]: 0,
      [BrowserState.CLOSING]: 0,
    };

    // Count browsers in each state
    for (const browser of browsers) {
      if (browser.state in this.metrics.stateDistribution) {
        this.metrics.stateDistribution[browser.state]++;
      }
    }

    // Update peak pool size
    const currentSize = browsers.length;
    if (currentSize > this.metrics.peakPoolSize) {
      this.metrics.peakPoolSize = currentSize;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const currentMetrics = { ...this.metrics };

    // Add calculated metrics
    currentMetrics['reuseRatio'] =
      this.metrics.reuse.totalCreated > 0
        ? this.metrics.reuse.reuseCount / this.metrics.reuse.totalCreated
        : 0;

    currentMetrics['successRate'] =
      this.metrics.requestsServed > 0
        ? 1 - this.metrics.errors / this.metrics.requestsServed
        : 1;

    return currentMetrics;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.created = 0;
    this.metrics.closed = 0;
    this.metrics.errors = 0;
    this.metrics.requestsServed = 0;
    this.metrics.avgCreationTime = 0;
    this.metrics.peakPoolSize = 0;
    this.metrics.stateDistribution = {
      [BrowserState.AVAILABLE]: 0,
      [BrowserState.IN_USE]: 0,
      [BrowserState.CLOSING]: 0,
    };
    this.metrics.reuse = {
      reuseCount: 0,
      totalCreated: 0,
    };
    this.creationTimes = [];
  }
}

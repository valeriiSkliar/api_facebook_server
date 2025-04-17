export enum ApiConfigStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  COOLING_DOWN = 'COOLING_DOWN',
}

export interface ApiConfigData {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  params?: Record<string, any>;
  responseData?: any;
}

export interface ApiConfig {
  id: number;
  accountId: number;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  params?: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  status: ApiConfigStatus;
  usageCount: number;
  lastUsedAt?: Date;
  responseData?: any;
}

export interface ApiConfigMetrics {
  totalConfigs: number;
  activeConfigs: number;
  expiredConfigs: number;
  coolingDownConfigs: number;
  averageUsageCount: number;
  totalUsageCount: number;
}

export interface AccountApiConfigMetrics {
  accountId: number;
  totalConfigs: number;
  activeConfigs: number;
  expiredConfigs: number;
  coolingDownConfigs: number;
  averageUsageCount: number;
  totalUsageCount: number;
}

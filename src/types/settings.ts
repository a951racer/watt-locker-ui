export interface ConnectedSource {
  provider: string;
  connected: boolean;
  connectedAt?: string;
}

export interface UserSettings {
  userId: string;
  driveStoragePath: string;
  driveInboxPath: string;
  connectedSources: ConnectedSource[];
  ftpHistory?: Array<{ effectiveDate: string; ftpWatts: number }>;
  timezone: string;
  updatedAt: string;
}

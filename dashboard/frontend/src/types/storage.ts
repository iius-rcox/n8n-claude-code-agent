/**
 * Azure Blob Storage item
 */
export interface BlobItem {
  name: string; // Full path: "container/folder/file.json"
  container: string;
  size: number; // bytes
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Search match information
 */
export interface SearchMatch {
  blob: BlobItem;
  matchIndex: number; // Position of match in blob name
  matchLength: number;
}

/**
 * File search state management
 */
export interface FileSearchState {
  query: string;
  filteredBlobs: BlobItem[];
  matchCount: number;
  totalCount: number;
  searchActive: boolean;
}

/**
 * Storage search API response
 */
export interface SearchStorageResponse {
  query: string;
  container: string;
  results: Array<BlobItem & { matchIndex: number }>;
  matchCount: number;
  totalCount: number;
  performanceMs?: number;
}

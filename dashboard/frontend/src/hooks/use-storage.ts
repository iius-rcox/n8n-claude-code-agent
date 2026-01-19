import { useState, useEffect, useCallback } from 'react';
import {
  getStorageContainers,
  listBlobs,
  getBlobContent,
  deleteBlob,
  breakBlobLease,
  StorageContainer,
  BlobItem,
  BlobContentResponse,
} from '@/services/api';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface UseStorageReturn {
  // Container state
  containers: StorageContainer[];
  selectedContainer: string | null;
  selectContainer: (container: string) => void;

  // Blob browsing state
  blobs: BlobItem[];
  currentPath: string;
  breadcrumbs: BreadcrumbItem[];
  navigateTo: (path: string) => void;
  navigateUp: () => void;

  // Blob preview state
  selectedBlob: BlobItem | null;
  blobContent: BlobContentResponse | null;
  selectBlob: (blob: BlobItem | null) => void;
  isLoadingContent: boolean;

  // Operations
  deleteBlobItem: (blob: BlobItem) => Promise<void>;
  breakLease: (blob: BlobItem) => Promise<void>;
  refresh: () => void;

  // Loading and error state
  isLoading: boolean;
  error: string | null;
  operationError: string | null;
  clearOperationError: () => void;

  // Pagination
  hasMore: boolean;
  loadMore: () => void;
  continuationToken: string | undefined;
}

export function useStorage(): UseStorageReturn {
  // Container state
  const [containers, setContainers] = useState<StorageContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  // Blob browsing state
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Blob preview state
  const [selectedBlob, setSelectedBlob] = useState<BlobItem | null>(null);
  const [blobContent, setBlobContent] = useState<BlobContentResponse | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Calculate breadcrumbs from current path
  const breadcrumbs: BreadcrumbItem[] = [{ name: 'Root', path: '' }];
  if (currentPath) {
    const parts = currentPath.split('/').filter(Boolean);
    let accPath = '';
    for (const part of parts) {
      accPath = accPath ? `${accPath}/${part}` : part;
      breadcrumbs.push({ name: part, path: accPath });
    }
  }

  // Fetch containers on mount
  const fetchContainers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getStorageContainers();
      setContainers(data.containers);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch containers';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch blobs for selected container and path
  const fetchBlobs = useCallback(
    async (append: boolean = false) => {
      if (!selectedContainer) return;

      try {
        setIsLoading(true);
        const data = await listBlobs(
          selectedContainer,
          currentPath,
          50,
          append ? continuationToken : undefined
        );

        if (append) {
          setBlobs((prev) => [...prev, ...data.blobs]);
        } else {
          setBlobs(data.blobs);
        }
        setContinuationToken(data.continuationToken);
        setHasMore(data.hasMore);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch blobs';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedContainer, currentPath, continuationToken]
  );

  // Fetch blob content when a blob is selected
  const fetchBlobContent = useCallback(async (blob: BlobItem) => {
    if (blob.isDirectory) return;

    try {
      setIsLoadingContent(true);
      const container = selectedContainer;
      if (!container) return;

      const data = await getBlobContent(container, blob.path);
      setBlobContent(data);
    } catch (err) {
      console.error('Failed to fetch blob content:', err);
      setBlobContent(null);
    } finally {
      setIsLoadingContent(false);
    }
  }, [selectedContainer]);

  // Initial container fetch
  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  // Fetch blobs when container or path changes
  useEffect(() => {
    if (selectedContainer) {
      setBlobs([]);
      setContinuationToken(undefined);
      fetchBlobs(false);
    }
  }, [selectedContainer, currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch content when blob is selected
  useEffect(() => {
    if (selectedBlob && !selectedBlob.isDirectory) {
      fetchBlobContent(selectedBlob);
    } else {
      setBlobContent(null);
    }
  }, [selectedBlob, fetchBlobContent]);

  // Select a container
  const selectContainer = useCallback((container: string) => {
    setSelectedContainer(container);
    setCurrentPath('');
    setSelectedBlob(null);
    setBlobContent(null);
  }, []);

  // Navigate to a path (directory)
  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedBlob(null);
    setBlobContent(null);
  }, []);

  // Navigate up one level
  const navigateUp = useCallback(() => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedBlob(null);
    setBlobContent(null);
  }, [currentPath]);

  // Select a blob for preview
  const selectBlob = useCallback((blob: BlobItem | null) => {
    if (blob?.isDirectory) {
      navigateTo(blob.path);
    } else {
      setSelectedBlob(blob);
    }
  }, [navigateTo]);

  // Delete a blob
  const deleteBlobItem = useCallback(
    async (blob: BlobItem) => {
      if (!selectedContainer) return;

      try {
        setOperationError(null);
        await deleteBlob(selectedContainer, blob.path);
        // Refresh the blob list
        fetchBlobs(false);
        // Clear selection if deleted blob was selected
        if (selectedBlob?.path === blob.path) {
          setSelectedBlob(null);
          setBlobContent(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete blob';
        setOperationError(message);
        throw err;
      }
    },
    [selectedContainer, selectedBlob, fetchBlobs]
  );

  // Break a lease on a blob
  const breakLease = useCallback(
    async (blob: BlobItem) => {
      if (!selectedContainer) return;

      try {
        setOperationError(null);
        await breakBlobLease(selectedContainer, blob.path);
        // Refresh the blob list
        fetchBlobs(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to break lease';
        setOperationError(message);
        throw err;
      }
    },
    [selectedContainer, fetchBlobs]
  );

  // Refresh current view
  const refresh = useCallback(() => {
    if (selectedContainer) {
      fetchBlobs(false);
    } else {
      fetchContainers();
    }
  }, [selectedContainer, fetchBlobs, fetchContainers]);

  // Load more blobs (pagination)
  const loadMore = useCallback(() => {
    if (hasMore && continuationToken) {
      fetchBlobs(true);
    }
  }, [hasMore, continuationToken, fetchBlobs]);

  // Clear operation error
  const clearOperationError = useCallback(() => {
    setOperationError(null);
  }, []);

  return {
    containers,
    selectedContainer,
    selectContainer,
    blobs,
    currentPath,
    breadcrumbs,
    navigateTo,
    navigateUp,
    selectedBlob,
    blobContent,
    selectBlob,
    isLoadingContent,
    deleteBlobItem,
    breakLease,
    refresh,
    isLoading,
    error,
    operationError,
    clearOperationError,
    hasMore,
    loadMore,
    continuationToken,
  };
}

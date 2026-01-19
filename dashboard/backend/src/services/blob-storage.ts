import {
  BlobServiceClient,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Config } from '../config.js';
import {
  StorageContainer,
  StorageBlob,
  BlobListResponse,
  BlobContentResponse,
  BlobDownloadResponse,
  LeaseState,
  LeaseStatus,
  CONTAINER_PURPOSES,
} from '../types/observability.js';

export class BlobStorageService {
  private blobServiceClient: BlobServiceClient;
  private accountName: string;

  constructor(config: Config) {
    this.accountName = config.storage.accountName;

    if (config.storage.connectionString) {
      // Local development with connection string
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        config.storage.connectionString
      );
    } else {
      // Production with Workload Identity
      const credential = new DefaultAzureCredential();
      this.blobServiceClient = new BlobServiceClient(
        `https://${this.accountName}.blob.core.windows.net`,
        credential
      );
    }
  }

  /**
   * List all containers in the storage account
   */
  async listContainers(): Promise<StorageContainer[]> {
    const containers: StorageContainer[] = [];

    for await (const container of this.blobServiceClient.listContainers()) {
      containers.push({
        name: container.name,
        purpose: CONTAINER_PURPOSES[container.name] || 'Unknown purpose',
        lastModified: container.properties?.lastModified?.toISOString(),
      });
    }

    return containers;
  }

  /**
   * List blobs in a container with optional path prefix
   */
  async listBlobs(
    containerName: string,
    path: string = '',
    limit: number = 50,
    continuationToken?: string
  ): Promise<BlobListResponse> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobs: StorageBlob[] = [];
    const folders = new Set<string>();

    const options = {
      prefix: path,
      maxPageSize: limit,
    };

    const iterator = containerClient
      .listBlobsFlat(options)
      .byPage({ continuationToken, maxPageSize: limit });

    const page = await iterator.next();

    if (page.value?.segment?.blobItems) {
      for (const blob of page.value.segment.blobItems) {
        // Check if this is a "folder" (blob with path containing /)
        const relativePath = path ? blob.name.slice(path.length) : blob.name;
        const slashIndex = relativePath.indexOf('/');

        if (slashIndex !== -1) {
          // This blob is in a subfolder - add the folder name
          const folderName = relativePath.slice(0, slashIndex);
          folders.add(folderName);
        } else {
          // This is a direct blob at the current path level
          const extension = this.getExtension(blob.name);
          blobs.push({
            name: this.getFileName(blob.name),
            path: blob.name,
            container: containerName,
            size: blob.properties?.contentLength || 0,
            contentType: blob.properties?.contentType || 'application/octet-stream',
            lastModified: blob.properties?.lastModified?.toISOString() || new Date().toISOString(),
            leaseState: (blob.properties?.leaseState as LeaseState) || 'available',
            leaseStatus: (blob.properties?.leaseStatus as LeaseStatus) || 'unlocked',
            isFolder: false,
            extension,
          });
        }
      }
    }

    return {
      container: containerName,
      path,
      blobs,
      folders: Array.from(folders).sort(),
      hasMore: !!page.value?.continuationToken,
      continuationToken: page.value?.continuationToken,
    };
  }

  /**
   * Get blob content for preview (text files only)
   */
  async getBlobContent(
    containerName: string,
    blobPath: string,
    maxSize: number = 102400 // 100KB default
  ): Promise<BlobContentResponse> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);

    // Get blob properties first
    const properties = await blobClient.getProperties();
    const size = properties.contentLength || 0;
    const truncated = size > maxSize;

    // Download content (up to maxSize)
    const downloadResponse = await blobClient.download(0, truncated ? maxSize : undefined);
    const content = await this.streamToString(downloadResponse.readableStreamBody!);

    const extension = this.getExtension(blobPath);
    const blob: StorageBlob = {
      name: this.getFileName(blobPath),
      path: blobPath,
      container: containerName,
      size,
      contentType: properties.contentType || 'application/octet-stream',
      lastModified: properties.lastModified?.toISOString() || new Date().toISOString(),
      leaseState: (properties.leaseState as LeaseState) || 'available',
      leaseStatus: (properties.leaseStatus as LeaseStatus) || 'unlocked',
      isFolder: false,
      extension,
    };

    return { blob, content, truncated };
  }

  /**
   * Generate a time-limited SAS URL for downloading a blob
   */
  async generateDownloadUrl(
    containerName: string,
    blobPath: string,
    expiresInMinutes: number = 15
  ): Promise<BlobDownloadResponse> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);

    // Get blob properties
    const properties = await blobClient.getProperties();

    // Generate SAS token using user delegation key
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

    // Use the blob's existing URL with SAS
    const sasUrl = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.from({ read: true }),
      startsOn,
      expiresOn,
    });

    const extension = this.getExtension(blobPath);
    const blob: StorageBlob = {
      name: this.getFileName(blobPath),
      path: blobPath,
      container: containerName,
      size: properties.contentLength || 0,
      contentType: properties.contentType || 'application/octet-stream',
      lastModified: properties.lastModified?.toISOString() || new Date().toISOString(),
      leaseState: (properties.leaseState as LeaseState) || 'available',
      leaseStatus: (properties.leaseStatus as LeaseStatus) || 'unlocked',
      isFolder: false,
      extension,
    };

    return {
      blob,
      downloadUrl: sasUrl,
      expiresAt: expiresOn.toISOString(),
    };
  }

  /**
   * Delete a blob (requires confirmation)
   */
  async deleteBlob(containerName: string, blobPath: string): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);
    await blobClient.delete();
  }

  /**
   * Break a lease on a stuck blob
   */
  async breakLease(containerName: string, blobPath: string): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);
    const leaseClient = blobClient.getBlobLeaseClient();
    await leaseClient.breakLease(0); // 0 = break immediately
  }

  /**
   * Upload or update blob content
   */
  async uploadBlob(
    containerName: string,
    blobPath: string,
    content: string,
    contentType: string = 'text/plain'
  ): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  /**
   * Check storage health by attempting to list containers
   */
  async checkHealth(): Promise<{ healthy: boolean; containers: string[]; error?: string }> {
    try {
      const containers: string[] = [];
      for await (const container of this.blobServiceClient.listContainers()) {
        containers.push(container.name);
      }
      return { healthy: true, containers };
    } catch (error) {
      return {
        healthy: false,
        containers: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper methods

  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  private getExtension(path: string): string | undefined {
    const fileName = this.getFileName(path);
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : undefined;
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

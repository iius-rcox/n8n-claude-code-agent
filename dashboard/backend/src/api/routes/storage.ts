import { Router, Request, Response, NextFunction } from 'express';
import { BlobStorageService } from '../../services/blob-storage.js';

export function createStorageRouter(blobStorageService: BlobStorageService): Router {
  const router = Router();

  /**
   * GET /api/storage/containers
   * List all storage containers
   */
  router.get('/containers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const containers = await blobStorageService.listContainers();
      res.json({ containers });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/storage/containers/:container/blobs
   * List blobs in a container with optional path prefix
   */
  router.get(
    '/containers/:container/blobs',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { container } = req.params;
        const path = (req.query.path as string) || '';
        const limit = parseInt((req.query.limit as string) || '50', 10);
        const continuationToken = req.query.continuationToken as string | undefined;

        const result = await blobStorageService.listBlobs(container, path, limit, continuationToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/storage/containers/:container/blobs/(path)
   * Get blob content for preview (supports nested paths)
   */
  router.get(
    '/containers/:container/blobs/*',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { container } = req.params;
        // Get the full blob path from the URL (everything after /blobs/)
        const blobPath = req.params[0];

        if (!blobPath) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Blob path is required',
          });
          return;
        }

        // Check if this is a download request
        if (req.query.download === 'true') {
          const expiresInMinutes = parseInt((req.query.expiresIn as string) || '15', 10);
          const result = await blobStorageService.generateDownloadUrl(
            container,
            blobPath,
            expiresInMinutes
          );
          res.json(result);
          return;
        }

        // Otherwise, return content preview
        const maxSize = parseInt((req.query.maxSize as string) || '102400', 10);
        const result = await blobStorageService.getBlobContent(container, blobPath, maxSize);
        res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          res.status(404).json({
            error: 'Not Found',
            message: 'Blob not found',
          });
          return;
        }
        next(error);
      }
    }
  );

  /**
   * DELETE /api/storage/containers/:container/blobs/(path)
   * Delete a blob (requires confirm=true in body)
   */
  router.delete(
    '/containers/:container/blobs/*',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { container } = req.params;
        const blobPath = req.params[0];

        if (!blobPath) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Blob path is required',
          });
          return;
        }

        // Check for confirmation
        if (req.body?.confirm !== true) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Deletion requires confirmation. Set confirm: true in request body.',
          });
          return;
        }

        await blobStorageService.deleteBlob(container, blobPath);
        res.json({
          success: true,
          message: `Blob ${blobPath} deleted from ${container}`,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/storage/containers/:container/blobs/(path)/break-lease
   * Break a lease on a stuck blob
   */
  router.post(
    '/containers/:container/blobs/*/break-lease',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { container } = req.params;
        // Extract blob path - need to handle the /break-lease suffix
        const fullPath = req.params[0];
        const blobPath = fullPath.replace(/\/break-lease$/, '');

        if (!blobPath) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Blob path is required',
          });
          return;
        }

        // Check for confirmation
        if (req.body?.confirm !== true) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Lease break requires confirmation. Set confirm: true in request body.',
          });
          return;
        }

        await blobStorageService.breakLease(container, blobPath);
        res.json({
          success: true,
          message: `Lease broken on ${blobPath} in ${container}`,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

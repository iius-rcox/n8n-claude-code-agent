import { useState } from 'react';
import {
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  ChevronRight,
  RefreshCw,
  Download,
  Trash2,
  Unlock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStorage } from '@/hooks/use-storage';
import { BlobItem, getBlobDownloadUrl } from '@/services/api';
import { cn } from '@/lib/utils';

// Helper to format file size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Get icon for file type
function getFileIcon(blob: BlobItem) {
  if (blob.isDirectory) {
    return <FolderOpen className="h-4 w-4 text-yellow-500" />;
  }

  const ext = blob.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return <FileJson className="h-4 w-4 text-orange-500" />;
    case 'yml':
    case 'yaml':
      return <FileCode className="h-4 w-4 text-purple-500" />;
    case 'md':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'ts':
    case 'js':
    case 'tsx':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-yellow-600" />;
    default:
      return <File className="h-4 w-4 text-gray-500" />;
  }
}

// Blob row component
interface BlobRowProps {
  blob: BlobItem;
  onClick: () => void;
  onDelete: () => void;
  onBreakLease: () => void;
  isSelected: boolean;
}

function BlobRow({ blob, onClick, onDelete, onBreakLease, isSelected }: BlobRowProps) {
  const hasLease = blob.leaseState === 'leased';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0',
        isSelected && 'bg-blue-50'
      )}
      onClick={onClick}
    >
      {getFileIcon(blob)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{blob.name}</span>
          {hasLease && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              Leased
            </Badge>
          )}
        </div>
        {!blob.isDirectory && blob.size !== undefined && (
          <div className="text-xs text-gray-500">
            {formatBytes(blob.size)}
            {blob.lastModified && ` • ${formatRelativeTime(blob.lastModified)}`}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {hasLease && (
          <Button variant="ghost" size="sm" onClick={onBreakLease} title="Break Lease">
            <Unlock className="h-4 w-4 text-orange-500" />
          </Button>
        )}
        {!blob.isDirectory && (
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
        {blob.isDirectory && <ChevronRight className="h-4 w-4 text-gray-400" />}
      </div>
    </div>
  );
}

// Content preview component
interface ContentPreviewProps {
  content: string;
  contentType: string;
  truncated: boolean;
  encoding: 'utf-8' | 'base64';
}

function ContentPreview({ content, contentType, truncated, encoding }: ContentPreviewProps) {
  if (encoding === 'base64') {
    return (
      <div className="p-4 bg-gray-100 rounded text-center text-gray-500">
        Binary file (base64 encoded) - Download to view
      </div>
    );
  }

  const isCode =
    contentType.includes('json') ||
    contentType.includes('yaml') ||
    contentType.includes('javascript') ||
    contentType.includes('typescript') ||
    contentType.includes('text/plain');

  return (
    <div className="relative">
      {truncated && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-t">
          Content truncated - download for full file
        </div>
      )}
      <pre
        className={cn(
          'p-4 bg-gray-900 text-gray-100 rounded overflow-auto max-h-96 text-sm',
          truncated && 'mt-6'
        )}
      >
        <code className={isCode ? 'language-' + contentType.split('/').pop() : ''}>
          {content}
        </code>
      </pre>
    </div>
  );
}

export function StorageBrowser() {
  const {
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
  } = useStorage();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlobItem | null>(null);
  const [leaseTarget, setLeaseTarget] = useState<BlobItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle download
  const handleDownload = async () => {
    if (!selectedContainer || !selectedBlob || selectedBlob.isDirectory) return;

    try {
      setIsDownloading(true);
      const result = await getBlobDownloadUrl(selectedContainer, selectedBlob.path);
      window.open(result.downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to get download URL:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBlobItem(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // Error is handled by hook
    }
  };

  // Handle lease break confirmation
  const handleLeaseBreakConfirm = async () => {
    if (!leaseTarget) return;
    try {
      await breakLease(leaseTarget);
      setLeaseTarget(null);
    } catch {
      // Error is handled by hook
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Storage Browser</CardTitle>
              {selectedContainer && (
                <Badge variant="secondary">{selectedContainer}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </div>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent>
            {/* Error display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Container selector */}
            <div className="mb-4">
              <Select value={selectedContainer || ''} onValueChange={selectContainer}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a container" />
                </SelectTrigger>
                <SelectContent>
                  {containers.map((container) => (
                    <SelectItem key={container.name} value={container.name}>
                      {container.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContainer && (
              <>
                {/* Breadcrumb navigation */}
                <div className="mb-4 flex items-center gap-1 text-sm">
                  {breadcrumbs.map((crumb, idx) => (
                    <span key={crumb.path} className="flex items-center">
                      {idx > 0 && <ChevronRight className="h-3 w-3 mx-1 text-gray-400" />}
                      <button
                        onClick={() => navigateTo(crumb.path)}
                        className={cn(
                          'hover:text-blue-600 hover:underline',
                          idx === breadcrumbs.length - 1
                            ? 'font-medium text-gray-900'
                            : 'text-gray-500'
                        )}
                      >
                        {idx === 0 ? <Home className="h-3 w-3" /> : crumb.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Main content area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* File list */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium text-gray-700">
                      Files {blobs.length > 0 && `(${blobs.length})`}
                    </div>
                    <div className="max-h-96 overflow-auto">
                      {currentPath && (
                        <div
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b text-gray-500"
                          onClick={navigateUp}
                        >
                          <FolderOpen className="h-4 w-4" />
                          <span>..</span>
                        </div>
                      )}
                      {blobs.length === 0 && !isLoading && (
                        <div className="p-4 text-center text-gray-500">
                          No files in this location
                        </div>
                      )}
                      {blobs.map((blob) => (
                        <BlobRow
                          key={blob.path}
                          blob={blob}
                          onClick={() => selectBlob(blob)}
                          onDelete={() => setDeleteTarget(blob)}
                          onBreakLease={() => setLeaseTarget(blob)}
                          isSelected={selectedBlob?.path === blob.path}
                        />
                      ))}
                      {hasMore && (
                        <div className="p-2 text-center">
                          <Button variant="outline" size="sm" onClick={loadMore}>
                            Load More
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview panel */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium text-gray-700 flex items-center justify-between">
                      <span>Preview</span>
                      {selectedBlob && !selectedBlob.isDirectory && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          disabled={isDownloading}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                    <div className="p-4">
                      {!selectedBlob && (
                        <div className="text-center text-gray-500">
                          Select a file to preview
                        </div>
                      )}
                      {selectedBlob && selectedBlob.isDirectory && (
                        <div className="text-center text-gray-500">
                          Click to enter directory
                        </div>
                      )}
                      {selectedBlob && !selectedBlob.isDirectory && isLoadingContent && (
                        <div className="text-center text-gray-500">Loading...</div>
                      )}
                      {selectedBlob &&
                        !selectedBlob.isDirectory &&
                        !isLoadingContent &&
                        blobContent && (
                          <div>
                            <div className="mb-2 text-xs text-gray-500">
                              {blobContent.contentType} • {formatBytes(blobContent.size)}
                            </div>
                            <ContentPreview
                              content={blobContent.content}
                              contentType={blobContent.contentType}
                              truncated={blobContent.truncated}
                              encoding={blobContent.encoding}
                            />
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!selectedContainer && !isLoading && (
              <div className="text-center text-gray-500 py-8">
                Select a container to browse files
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Blob</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lease break confirmation dialog */}
      <Dialog open={!!leaseTarget} onOpenChange={() => setLeaseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Break Lease</DialogTitle>
            <DialogDescription>
              Are you sure you want to break the lease on <strong>{leaseTarget?.name}</strong>?
              This may cause issues if an agent is currently using this file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaseTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleLeaseBreakConfirm}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Break Lease
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Operation error dialog */}
      <Dialog open={!!operationError} onOpenChange={clearOperationError}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operation Failed</DialogTitle>
            <DialogDescription>{operationError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={clearOperationError}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

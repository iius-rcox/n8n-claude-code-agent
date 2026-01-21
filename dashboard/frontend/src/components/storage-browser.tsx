import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  HardDrive,
  Folder,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStorage } from '@/hooks/use-storage';
import { BlobItem, getBlobDownloadUrl } from '@/services/api';
import { cn } from '@/lib/utils';

// Container color mapping
const CONTAINER_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'agent-state': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: 'text-cyan-400' },
  'agent-spec': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'text-blue-400' },
  'agent-plan': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', icon: 'text-purple-400' },
  'agent-verification': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: 'text-yellow-400' },
  'agent-review': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', icon: 'text-orange-400' },
  'agent-release': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
};

const getContainerColor = (name: string) => {
  return CONTAINER_COLORS[name] || { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border/50', icon: 'text-muted-foreground' };
};

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

// Get icon for file type with enhanced styling
function getFileIcon(blob: BlobItem) {
  if (blob.isDirectory) {
    return <Folder className="h-4 w-4 text-amber-400" />;
  }

  const ext = blob.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return <FileJson className="h-4 w-4 text-orange-400" />;
    case 'yml':
    case 'yaml':
      return <FileCode className="h-4 w-4 text-purple-400" />;
    case 'md':
      return <FileText className="h-4 w-4 text-blue-400" />;
    case 'ts':
    case 'js':
    case 'tsx':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
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
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-border/30 last:border-b-0',
        'hover:bg-muted/30 transition-colors',
        isSelected && 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
      )}
      onClick={onClick}
      whileHover={{ x: 2 }}
    >
      <div className="flex-shrink-0">
        {getFileIcon(blob)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate text-sm">{blob.name}</span>
          {hasLease && (
            <motion.span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30"
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="h-2.5 w-2.5" />
              Leased
            </motion.span>
          )}
        </div>
        {!blob.isDirectory && blob.size !== undefined && (
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {formatBytes(blob.size)}
            {blob.lastModified && (
              <span className="ml-2 text-muted-foreground/70">{formatRelativeTime(blob.lastModified)}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {hasLease && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBreakLease}
            title="Break Lease"
            className="h-7 w-7 p-0 hover:bg-orange-500/10"
          >
            <Unlock className="h-3.5 w-3.5 text-orange-400" />
          </Button>
        )}
        {!blob.isDirectory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete"
            className="h-7 w-7 p-0 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        )}
        {blob.isDirectory && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </motion.div>
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
      <div className="p-4 bg-muted/30 rounded-lg text-center text-muted-foreground border border-border/50">
        <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Binary file (base64 encoded)</p>
        <p className="text-xs mt-1">Download to view</p>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="h-3 w-3" />
          Content truncated - download for full file
        </motion.div>
      )}
      <pre
        className={cn(
          'p-4 bg-background/80 border border-border/50 rounded-lg overflow-auto max-h-80 text-sm font-mono',
          'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent'
        )}
      >
        <code className={cn(
          isCode ? 'language-' + contentType.split('/').pop() : '',
          'text-foreground'
        )}>
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

  const containerColor = selectedContainer ? getContainerColor(selectedContainer) : null;

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
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className={`cursor-pointer select-none border-b border-border/30 ${isCollapsed ? 'hover:bg-muted/50' : ''}`}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
              <HardDrive className="h-5 w-5 text-emerald-400" />
              <div>
                <CardTitle className="flex items-center gap-3 text-base">
                  <span>Storage Browser</span>
                  {selectedContainer && containerColor && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${containerColor.bg} ${containerColor.text} border ${containerColor.border}`}>
                      {selectedContainer}
                    </span>
                  )}
                </CardTitle>
                {!isCollapsed && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browse Azure Blob Storage containers
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
                disabled={isLoading}
                className="hover:bg-muted"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-4">
                {/* Error display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}

                {/* Container selector with color chips */}
                <div className="mb-6">
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Container</label>
                  <div className="flex flex-wrap gap-2">
                    {containers.map((container) => {
                      const colors = getContainerColor(container.name);
                      const isActive = selectedContainer === container.name;
                      return (
                        <motion.button
                          key={container.name}
                          onClick={() => selectContainer(container.name)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            isActive
                              ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-offset-1 ring-offset-background`
                              : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                          )}
                          style={isActive ? { ['--tw-ring-color' as string]: colors.border.replace('border-', '').replace('/30', '') } : {}}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Database className={cn('h-3 w-3 inline mr-1.5', isActive ? colors.icon : '')} />
                          {container.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {selectedContainer && (
                  <>
                    {/* Breadcrumb navigation */}
                    <div className="mb-4 flex items-center gap-1 text-sm bg-muted/30 rounded-lg px-3 py-2">
                      {breadcrumbs.map((crumb, idx) => (
                        <span key={crumb.path} className="flex items-center">
                          {idx > 0 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground/50" />}
                          <button
                            onClick={() => navigateTo(crumb.path)}
                            className={cn(
                              'hover:text-cyan-400 transition-colors',
                              idx === breadcrumbs.length - 1
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {idx === 0 ? (
                              <Home className={cn('h-3.5 w-3.5', containerColor?.icon)} />
                            ) : (
                              crumb.name
                            )}
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Main content area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* File list */}
                      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                        <div className="px-3 py-2 border-b border-border/30 text-sm font-medium flex items-center justify-between bg-muted/20">
                          <span className="text-muted-foreground">Files</span>
                          {blobs.length > 0 && (
                            <span className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                              {blobs.length}
                            </span>
                          )}
                        </div>
                        <div className="max-h-96 overflow-auto group">
                          {currentPath && (
                            <motion.div
                              className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer border-b border-border/30 text-muted-foreground"
                              onClick={navigateUp}
                              whileHover={{ x: 2 }}
                            >
                              <FolderOpen className="h-4 w-4 text-amber-400" />
                              <span className="text-sm">..</span>
                            </motion.div>
                          )}
                          {blobs.length === 0 && !isLoading && (
                            <div className="p-8 text-center text-muted-foreground">
                              <Folder className="h-8 w-8 mx-auto mb-2 opacity-20" />
                              <p className="text-sm">No files in this location</p>
                            </div>
                          )}
                          <AnimatePresence>
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
                          </AnimatePresence>
                          {hasMore && (
                            <div className="p-3 text-center border-t border-border/30">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={loadMore}
                                className="border-border/50 hover:bg-muted"
                              >
                                Load More
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preview panel */}
                      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                        <div className="px-3 py-2 border-b border-border/30 text-sm font-medium flex items-center justify-between bg-muted/20">
                          <span className="text-muted-foreground">Preview</span>
                          {selectedBlob && !selectedBlob.isDirectory && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownload}
                              disabled={isDownloading}
                              className="h-7 text-xs border-border/50 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                        <div className="p-4 min-h-[200px]">
                          {!selectedBlob && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                              <File className="h-8 w-8 mb-2 opacity-20" />
                              <p className="text-sm">Select a file to preview</p>
                            </div>
                          )}
                          {selectedBlob && selectedBlob.isDirectory && (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                              <Folder className="h-8 w-8 mb-2 text-amber-400 opacity-50" />
                              <p className="text-sm">Click to enter directory</p>
                            </div>
                          )}
                          {selectedBlob && !selectedBlob.isDirectory && isLoadingContent && (
                            <div className="flex items-center justify-center py-8">
                              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {selectedBlob &&
                            !selectedBlob.isDirectory &&
                            !isLoadingContent &&
                            blobContent && (
                              <div>
                                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="px-1.5 py-0.5 rounded bg-muted/50 font-mono">
                                    {blobContent.contentType}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono">{formatBytes(blobContent.size)}</span>
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
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Database className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm">Select a container to browse files</p>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
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

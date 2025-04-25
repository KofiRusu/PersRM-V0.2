import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc';

interface FormDiffViewerProps {
  schemaId: string;
  baseVersionId: string;
  compareVersionId: string;
  onExplainChange?: (fieldPath: string) => void;
  showSummary?: boolean;
  highlightBreakingChanges?: boolean;
  showApplyButton?: boolean;
  onApplyChanges?: (versionId: string) => void;
}

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

interface FieldDiff {
  path: string;
  type: DiffType;
  baseValue?: any;
  compareValue?: any;
  isBreakingChange?: boolean;
  diffDetails?: {
    type?: string;
    constraints?: string[];
    format?: string;
    required?: boolean;
  };
}

export const FormDiffViewer: React.FC<FormDiffViewerProps> = ({
  schemaId,
  baseVersionId,
  compareVersionId,
  onExplainChange,
  showSummary = true,
  highlightBreakingChanges = true,
  showApplyButton = false,
  onApplyChanges,
}) => {
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [diffData, setDiffData] = useState<FieldDiff[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch diff data using tRPC
  const { data: diff, isLoading, error } = trpc.schemas.compareVersions.useQuery({
    schemaId,
    baseVersionId,
    compareVersionId,
  });

  // Get AI explanation for changes
  const { mutate: explainChanges, isLoading: isExplaining } = trpc.ai.explainSchemaChanges.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Change Explanation",
        description: data.explanation,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get explanation",
        variant: "destructive",
      });
    },
  });

  // Process diff data when it arrives
  useEffect(() => {
    if (diff) {
      // Process the diff data into a format easier to work with
      const processed: FieldDiff[] = Object.entries(diff.fields).map(([path, changes]) => {
        return {
          path,
          type: changes.type as DiffType,
          baseValue: changes.baseValue,
          compareValue: changes.compareValue,
          isBreakingChange: changes.isBreakingChange,
          diffDetails: changes.details,
        };
      });
      
      setDiffData(processed);
      
      // Auto-expand paths with changes
      const newExpandedPaths = new Set<string>();
      processed.forEach(item => {
        if (item.type !== 'unchanged') {
          const parts = item.path.split('.');
          let currentPath = '';
          parts.forEach(part => {
            currentPath = currentPath ? `${currentPath}.${part}` : part;
            newExpandedPaths.add(currentPath);
          });
        }
      });
      
      setExpandedPaths(newExpandedPaths);
    }
  }, [diff]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Get field changes for a specific path
  const getFieldChanges = (path: string): FieldDiff | undefined => {
    return diffData.find(item => item.path === path);
  };

  // Get all children paths for a specific path
  const getChildPaths = (parentPath: string): string[] => {
    const prefix = parentPath ? `${parentPath}.` : '';
    return diffData
      .map(item => item.path)
      .filter(path => path.startsWith(prefix) && path !== parentPath)
      .filter(path => {
        const remaining = path.substring(prefix.length);
        return !remaining.includes('.'); // Only direct children
      });
  };

  // Check if a path has any changed children
  const hasChangedChildren = (path: string): boolean => {
    const prefix = path ? `${path}.` : '';
    return diffData.some(item => 
      item.path.startsWith(prefix) && item.type !== 'unchanged'
    );
  };

  // Get color for diff type
  const getDiffColor = (type: DiffType, isBreaking = false): string => {
    if (isBreaking && highlightBreakingChanges) {
      return 'text-destructive font-bold';
    }
    
    switch (type) {
      case 'added':
        return 'text-green-600 dark:text-green-400';
      case 'removed':
        return 'text-red-600 dark:text-red-400';
      case 'changed':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return '';
    }
  };

  // Get diff summary
  const getDiffSummary = () => {
    const added = diffData.filter(item => item.type === 'added').length;
    const removed = diffData.filter(item => item.type === 'removed').length;
    const changed = diffData.filter(item => item.type === 'changed').length;
    const breaking = diffData.filter(item => item.isBreakingChange).length;
    
    return { added, removed, changed, breaking };
  };

  // Handle explain change request
  const handleExplainChange = (path: string) => {
    if (onExplainChange) {
      onExplainChange(path);
    } else {
      explainChanges({
        schemaId,
        baseVersionId,
        compareVersionId,
        fieldPath: path,
      });
    }
  };

  // Render a field row
  const renderFieldRow = (path: string, depth = 0) => {
    const changes = getFieldChanges(path);
    const hasChildren = getChildPaths(path).length > 0;
    const isExpanded = expandedPaths.has(path);
    const type = changes?.type || 'unchanged';
    const isBreaking = changes?.isBreakingChange || false;
    
    const indentStyle = { paddingLeft: `${depth * 20}px` };
    const childPaths = getChildPaths(path);
    
    return (
      <React.Fragment key={path}>
        <div 
          className={`flex items-center py-2 px-4 border-b hover:bg-muted/50 ${
            type !== 'unchanged' ? 'font-medium' : ''
          }`}
        >
          <div className="flex-1 flex items-center" style={indentStyle}>
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 mr-2"
                onClick={() => togglePath(path)}
              >
                {isExpanded ? '−' : '+'}
              </Button>
            )}
            
            <span className={getDiffColor(type, isBreaking)}>
              {path.split('.').pop()}
              
              {type !== 'unchanged' && (
                <Badge 
                  variant={type === 'added' ? 'outline' : type === 'removed' ? 'destructive' : 'secondary'}
                  className="ml-2"
                >
                  {type}
                </Badge>
              )}
              
              {isBreaking && highlightBreakingChanges && (
                <Badge variant="destructive" className="ml-2">
                  Breaking
                </Badge>
              )}
            </span>
          </div>
          
          {type !== 'unchanged' && onExplainChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExplainChange(path)}
              disabled={isExplaining}
            >
              Explain
            </Button>
          )}
        </div>
        
        {/* Show field details if expanded */}
        {isExpanded && changes && type !== 'unchanged' && (
          <div 
            className="py-2 px-4 bg-muted/20 border-b text-sm"
            style={{ paddingLeft: `${depth * 20 + 20}px` }}
          >
            {type === 'changed' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium mb-1">Before:</div>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(changes.baseValue, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="font-medium mb-1">After:</div>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(changes.compareValue, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {type === 'added' && (
              <div>
                <div className="font-medium mb-1">Added:</div>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(changes.compareValue, null, 2)}
                </pre>
              </div>
            )}
            
            {type === 'removed' && (
              <div>
                <div className="font-medium mb-1">Removed:</div>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(changes.baseValue, null, 2)}
                </pre>
              </div>
            )}
            
            {changes.diffDetails && Object.keys(changes.diffDetails).length > 0 && (
              <div className="mt-2">
                <div className="font-medium mb-1">Changes:</div>
                <ul className="list-disc list-inside">
                  {changes.diffDetails.type && (
                    <li>Type: {changes.diffDetails.type}</li>
                  )}
                  {changes.diffDetails.format && (
                    <li>Format: {changes.diffDetails.format}</li>
                  )}
                  {changes.diffDetails.constraints && changes.diffDetails.constraints.map((constraint, i) => (
                    <li key={i}>{constraint}</li>
                  ))}
                  {changes.diffDetails.required !== undefined && (
                    <li>Required: {changes.diffDetails.required ? 'Yes' : 'No'}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Render children if expanded */}
        {isExpanded && childPaths.map(childPath => renderFieldRow(childPath, depth + 1))}
      </React.Fragment>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading diff...</CardTitle>
          <CardDescription>Comparing schema versions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !diff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Failed to load diff</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error?.message || "Couldn't compare versions. Please try again."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No changes
  if (diffData.length === 0 || diffData.every(item => item.type === 'unchanged')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Changes</CardTitle>
          <CardDescription>These schema versions are identical</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              No differences were found between the selected versions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Diff summary
  const summary = getDiffSummary();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Schema Changes</CardTitle>
        <CardDescription>
          Comparing version {diff.baseVersion.version} to {diff.compareVersion.version}
        </CardDescription>
        
        {showSummary && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="bg-green-100 dark:bg-green-900">
              {summary.added} added
            </Badge>
            <Badge variant="outline" className="bg-red-100 dark:bg-red-900">
              {summary.removed} removed
            </Badge>
            <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
              {summary.changed} changed
            </Badge>
            {highlightBreakingChanges && summary.breaking > 0 && (
              <Badge variant="destructive">
                {summary.breaking} breaking changes
              </Badge>
            )}
          </div>
        )}
        
        {showApplyButton && (
          <div className="mt-4">
            <Button
              onClick={() => onApplyChanges?.(compareVersionId)}
              variant="default"
            >
              Apply These Changes
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="visual" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="visual">Visual Diff</TabsTrigger>
            <TabsTrigger value="json">JSON Diff</TabsTrigger>
          </TabsList>
          
          <TabsContent value="visual" className="pt-2">
            <ScrollArea className="h-[500px] rounded-md border">
              <div className="divide-y">
                {/* Root level paths */}
                {getChildPaths('').map(path => renderFieldRow(path))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="json" className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Base Version ({diff.baseVersion.version})</h3>
                <ScrollArea className="h-[500px] rounded-md border">
                  <pre className="p-4 text-xs">
                    {JSON.stringify(diff.baseSchema, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Compare Version ({diff.compareVersion.version})</h3>
                <ScrollArea className="h-[500px] rounded-md border">
                  <pre className="p-4 text-xs">
                    {JSON.stringify(diff.compareSchema, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FormDiffViewer; 
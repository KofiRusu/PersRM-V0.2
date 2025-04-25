import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ReasoningTree, 
  ReasoningNode, 
  TreeVisualizationConfig, 
  generateMockReasoningTree 
} from './models/ReasoningTreeTypes';
import { reasoningTreeService } from '@/app/common/reasoning-tree';
import { retentionService } from '@/app/common/retention';
import ReasoningTreeNode from './ReasoningTreeNode';
import { 
  Button, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui';
import { 
  ZoomIn, 
  ZoomOut, 
  ExpandAll, 
  CollapseAll, 
  Clock, 
  Download, 
  Upload, 
  Trash2, 
  LayoutTemplate, 
  RefreshCcw,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Maximize,
  Minimize,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion } from 'framer-motion';

interface ReasoningTreeVisualizerProps {
  className?: string;
  initialTreeId?: string;
  showControls?: boolean;
}

const ReasoningTreeVisualizer: React.FC<ReasoningTreeVisualizerProps> = ({
  className,
  initialTreeId,
  showControls = true,
}) => {
  const [tree, setTree] = useState<ReasoningTree | null>(null);
  const [config, setConfig] = useState<TreeVisualizationConfig>({
    showTimestamps: false,
    expandAll: true,
    highlightPath: false,
    zoomLevel: 1,
    layout: 'vertical',
    theme: 'default',
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [trees, setTrees] = useState<ReasoningTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track expanded state for all nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // New state for tracking expanded state of all nodes
  const [allExpanded, setAllExpanded] = useState<boolean>(true);
  
  // Initialize on component mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Initialize reasoning tree service
      await reasoningTreeService.initialize();
      
      // Load all trees
      const allTrees = reasoningTreeService.getAllTrees();
      setTrees(allTrees);
      
      // Set current tree if any exist
      if (initialTreeId) {
        const foundTree = allTrees.find(t => t.id === initialTreeId);
        if (foundTree) {
          setTree(foundTree);
        } else if (allTrees.length > 0) {
          setTree(allTrees[0]);
        }
      } else if (allTrees.length > 0) {
        setTree(allTrees[0]);
      } else {
        // Create a mock tree for demo purposes if no trees exist
        const mockTree = generateMockReasoningTree();
        setTree(mockTree);
      }
      
      setIsLoading(false);
      
      // Log visualization initialization
      retentionService.trackEvent('reasoning-tree-visualizer-initialized', {
        treeCount: allTrees.length,
      });
    };
    
    init();
  }, [initialTreeId]);
  
  // Handle node selection
  const handleNodeClick = (node: ReasoningNode) => {
    setSelectedNodeId(node.id);
    
    // Log node selection
    retentionService.trackEvent('reasoning-tree-node-selected', {
      treeId: tree?.id,
      nodeId: node.id,
      nodeType: node.type,
    });
  };
  
  // Handle tree selection change
  const handleTreeChange = (treeId: string) => {
    const selectedTree = trees.find(t => t.id === treeId);
    if (selectedTree) {
      setTree(selectedTree);
      setSelectedNodeId(null);
      
      // Log tree selection
      retentionService.trackEvent('reasoning-tree-selected', {
        treeId,
      });
    }
  };
  
  // Toggle timestamp visibility
  const toggleTimestamps = () => {
    setConfig(prev => ({
      ...prev,
      showTimestamps: !prev.showTimestamps,
    }));
    
    // Log toggle
    retentionService.trackEvent('reasoning-tree-timestamps-toggled', {
      showTimestamps: !config.showTimestamps,
    });
  };
  
  // Toggle single node expanded state
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);
  
  // Expand all nodes
  const expandAll = useCallback(() => {
    const getAllNodeIds = (nodes: ReasoningNode[]): string[] => {
      let ids: string[] = [];
      nodes.forEach(node => {
        ids.push(node.id);
        if (node.children && node.children.length > 0) {
          ids = [...ids, ...getAllNodeIds(node.children)];
        }
      });
      return ids;
    };
    
    setExpandedNodes(new Set(getAllNodeIds(tree?.nodes.values() || [])));
  }, [tree]);
  
  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);
  
  // Layout change handler
  const handleLayoutChange = (layout: 'vertical' | 'horizontal' | 'radial') => {
    setConfig(prev => ({
      ...prev,
      layout,
    }));
    
    // Log layout change
    retentionService.trackEvent('reasoning-tree-layout-changed', {
      layout,
    });
  };
  
  // Export tree to JSON
  const handleExportTree = () => {
    if (tree) {
      const jsonString = reasoningTreeService.exportToJson(tree.id);
      if (jsonString) {
        // Create a blob and download it
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reasoning-tree-${tree.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log export action
        retentionService.trackEvent('reasoning-tree-exported', {
          treeId: tree.id,
        });
      }
    }
  };
  
  // Import tree from JSON
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const importedTree = reasoningTreeService.importFromJson(content);
          if (importedTree) {
            // Refresh trees list
            const allTrees = reasoningTreeService.getAllTrees();
            setTrees(allTrees);
            
            // Set imported tree as current
            setTree(importedTree);
            
            // Log import success
            retentionService.trackEvent('reasoning-tree-imported', {
              treeId: importedTree.id,
              nodeCount: importedTree.nodes.size,
            });
          }
        } catch (error) {
          console.error('Error importing tree:', error);
          
          // Log import error
          retentionService.trackEvent('reasoning-tree-import-error', {
            error: (error as Error).message,
          });
        }
      };
      reader.readAsText(file);
      
      // Reset the input
      e.target.value = '';
    }
  };
  
  // Delete tree
  const handleDeleteTree = () => {
    if (tree) {
      const treeId = tree.id;
      reasoningTreeService.deleteTree(treeId);
      
      // Update trees list
      const allTrees = reasoningTreeService.getAllTrees();
      setTrees(allTrees);
      
      // Set a new current tree or null
      if (allTrees.length > 0) {
        setTree(allTrees[0]);
      } else {
        setTree(null);
      }
      
      // Log delete action
      retentionService.trackEvent('reasoning-tree-deleted', {
        treeId,
      });
    }
  };
  
  // Create mock tree for demo/testing
  const handleCreateMockTree = () => {
    const mockTree = generateMockReasoningTree();
    
    // Add tree to service
    reasoningTreeService.createTree(
      mockTree.rootNode.content,
      mockTree.metadata
    );
    
    // Update trees list
    const allTrees = reasoningTreeService.getAllTrees();
    setTrees(allTrees);
    
    // Set the new mock tree as current
    const newTree = allTrees[0];
    setTree(newTree);
    
    // Log mock tree creation
    retentionService.trackEvent('reasoning-tree-mock-created', {
      treeId: newTree.id,
    });
  };
  
  // Recursive node rendering function
  const renderNode = useCallback((node: ReasoningNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <motion.div 
        key={node.id} 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("pl-4 border-l border-muted", depth > 0 && "ml-4")}
      >
        <div className="flex items-center space-x-2 mb-1">
          {hasChildren ? (
            <button 
              onClick={() => toggleNode(node.id)} 
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[14px]" />
          )}
          <div className="flex-1 text-sm">
            <span className="font-medium">Prompt:</span> {node.prompt}
          </div>
        </div>
        <div className="pl-6 text-muted-foreground text-xs mb-2">
          <span className="font-medium">Response:</span> {node.response}
        </div>
        {isExpanded && hasChildren && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-2"
          >
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </motion.div>
        )}
      </motion.div>
    );
  }, [expandedNodes, toggleNode]);
  
  // Add collapse all function  
  const handleCollapseAll = () => {
    if (!tree) return;
    
    // Create a new set with no expanded nodes
    setExpandedNodes(new Set<string>([tree.rootNode || ""]));
    setAllExpanded(false);
    retentionService.trackEvent('reasoning_tree_collapse_all');
  };
  
  // Add expand all function
  const handleExpandAll = () => {
    if (!tree) return;
    
    // Get all node IDs to expand
    const allNodes = getAllNodeIds([...tree.nodes.values()]);
    setExpandedNodes(new Set<string>(allNodes));
    setAllExpanded(true);
    retentionService.trackEvent('reasoning_tree_expand_all');
  };
  
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-96", className)}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Controls */}
      {showControls && (
        <div className="flex flex-wrap gap-2 mb-4 p-2 bg-muted/40 rounded-md">
          {/* Tree selector */}
          <div className="flex items-center">
            <Select
              value={tree?.id || ''}
              onValueChange={handleTreeChange}
              disabled={trees.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a tree" />
              </SelectTrigger>
              <SelectContent>
                {trees.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.metadata?.queryText 
                      ? t.metadata.queryText.substring(0, 30) + '...' 
                      : `Tree ${t.id.substring(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Visualization controls */}
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="icon"
              title="Toggle timestamps"
              onClick={toggleTimestamps}
              className={config.showTimestamps ? 'bg-primary/20' : ''}
            >
              <Clock className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              title="Expand all nodes"
              onClick={handleExpandAll}
              disabled={!tree}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              title="Collapse all nodes"
              onClick={handleCollapseAll}
              disabled={!tree}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            
            <Select
              value={config.layout}
              onValueChange={(value) => handleLayoutChange(value as any)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Vertical</SelectItem>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Import/Export controls */}
          <div className="flex gap-1 ml-auto">
            <Button 
              variant="outline" 
              size="icon"
              title="Import tree"
              onClick={handleImportClick}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileImport} 
              accept=".json" 
              className="hidden" 
            />
            
            <Button 
              variant="outline" 
              size="icon"
              title="Export tree"
              onClick={handleExportTree}
              disabled={!tree}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              title="Create mock tree"
              onClick={handleCreateMockTree}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              title="Delete tree"
              onClick={handleDeleteTree}
              disabled={!tree}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Tree visualization area */}
      <div className="flex-1 overflow-auto border rounded-md p-4 relative">
        {!tree ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No reasoning trees available</p>
              <Button onClick={handleCreateMockTree}>
                Create Sample Tree
              </Button>
            </div>
          </div>
        ) : (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={2}
            centerOnInit={true}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Controls */}
                <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleCollapseAll}
                    title="Collapse all nodes"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleExpandAll}
                    title="Expand all nodes"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => zoomIn()}
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => zoomOut()}
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => resetTransform()}
                    title="Reset view"
                  >
                    <LayoutTemplate className="h-4 w-4" />
                  </Button>
                </div>
                
                <TransformComponent wrapperClass="min-h-[400px]">
                  <div className={cn(
                    "p-8",
                    config.layout === 'horizontal' && "flex",
                    config.layout === 'radial' && "flex justify-center items-center"
                  )}>
                    <div className="p-4 bg-background rounded">
                      {tree.rootNode && renderNode(tree.rootNode)}
                    </div>
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        )}
      </div>
      
      {/* Node details panel for selected node */}
      {selectedNodeId && tree && (
        <div className="mt-4 p-4 border rounded-md">
          <h3 className="text-lg font-medium mb-2">Node Details</h3>
          {(() => {
            const node = tree.nodes.get(selectedNodeId);
            if (!node) return <p>Node not found</p>;
            
            return (
              <div>
                <dl className="grid grid-cols-2 gap-2">
                  <dt className="text-sm font-medium">Type:</dt>
                  <dd className="text-sm">{node.type}</dd>
                  
                  <dt className="text-sm font-medium">Created:</dt>
                  <dd className="text-sm">{new Date(node.timestamp).toLocaleString()}</dd>
                  
                  <dt className="text-sm font-medium">Depth:</dt>
                  <dd className="text-sm">{node.depth}</dd>
                  
                  {node.metadata && Object.keys(node.metadata).length > 0 && (
                    <>
                      <dt className="text-sm font-medium">Metadata:</dt>
                      <dd className="text-sm">
                        <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
                          {JSON.stringify(node.metadata, null, 2)}
                        </pre>
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ReasoningTreeVisualizer; 
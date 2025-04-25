import React, { useState } from 'react';
import { ReasoningNode, NodeType } from './models/ReasoningTreeTypes';
import { 
  ChevronRight, 
  ChevronDown, 
  BrainCircuit, 
  LightbulbIcon, 
  PlayCircle, 
  Eye, 
  CheckCircle,
  XCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { reasoningTreeService } from '@/app/common/reasoning-tree';

interface ReasoningTreeNodeProps {
  node: ReasoningNode;
  treeId: string;
  isHighlighted?: boolean;
  showTimestamps?: boolean;
  onNodeClick?: (node: ReasoningNode) => void;
}

const getNodeIcon = (type: NodeType) => {
  switch (type) {
    case 'query':
      return <BrainCircuit className="h-4 w-4" />;
    case 'thought':
      return <LightbulbIcon className="h-4 w-4" />;
    case 'action':
      return <PlayCircle className="h-4 w-4" />;
    case 'observation':
      return <Eye className="h-4 w-4" />;
    case 'conclusion':
      return <CheckCircle className="h-4 w-4" />;
    case 'error':
      return <XCircle className="h-4 w-4" />;
    default:
      return <BrainCircuit className="h-4 w-4" />;
  }
};

const getNodeColor = (type: NodeType, isHighlighted: boolean) => {
  if (isHighlighted) return 'bg-primary/10 border-primary';
  
  switch (type) {
    case 'query':
      return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800';
    case 'thought':
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
    case 'action':
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
    case 'observation':
      return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800';
    case 'conclusion':
      return 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800';
    case 'error':
      return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
    default:
      return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
  }
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString()} (${Math.floor((Date.now() - timestamp) / 1000)}s ago)`;
};

const ReasoningTreeNode: React.FC<ReasoningTreeNodeProps> = ({
  node,
  treeId,
  isHighlighted = false,
  showTimestamps = false,
  onNodeClick,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = node.expanded !== false; // Default to expanded if not specified
  
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    reasoningTreeService.toggleNodeExpanded(treeId, node.id);
  };
  
  const handleNodeClick = () => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };
  
  // Format content based on type
  const formatContent = () => {
    if (node.type === 'conclusion' && node.content.includes('```')) {
      // Handle code blocks in conclusion nodes
      const parts = node.content.split('```');
      return (
        <>
          {parts.map((part, index) => 
            index % 2 === 0 ? (
              <p key={index} className="whitespace-pre-wrap">{part}</p>
            ) : (
              <pre key={index} className="bg-muted p-2 rounded-md overflow-x-auto my-2">
                <code>{part}</code>
              </pre>
            )
          )}
        </>
      );
    }
    
    return <p className="whitespace-pre-wrap">{node.content}</p>;
  };
  
  return (
    <div className="ml-4">
      <div 
        className={cn(
          "p-3 rounded-md border mt-2 transition-colors",
          getNodeColor(node.type, isHighlighted),
          isHighlighted && "ring-2 ring-primary",
          "hover:bg-opacity-80 dark:hover:bg-opacity-80 cursor-pointer"
        )}
        onClick={handleNodeClick}
        data-node-id={node.id}
        data-node-type={node.type}
      >
        <div className="flex items-start">
          <div 
            className="mr-2 cursor-pointer p-1"
            onClick={handleToggleExpand}
          >
            {hasChildren && (
              isExpanded ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
            )}
          </div>
          
          <div className="flex-shrink-0 mr-2 mt-1">
            {getNodeIcon(node.type)}
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between">
              <h4 className="font-medium capitalize">
                {node.type}
              </h4>
              
              {showTimestamps && (
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(node.timestamp)}
                </span>
              )}
            </div>
            
            <div className="mt-1 text-sm">
              {formatContent()}
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="border-l border-dashed border-muted ml-4 pl-2">
          {node.children!.map((child) => (
            <ReasoningTreeNode
              key={child.id}
              node={child}
              treeId={treeId}
              isHighlighted={isHighlighted}
              showTimestamps={showTimestamps}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReasoningTreeNode; 
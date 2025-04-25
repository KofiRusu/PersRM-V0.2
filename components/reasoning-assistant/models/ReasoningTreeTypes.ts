/**
 * Reasoning Tree Data Structure Types
 * 
 * This file defines the types used for storing and visualizing the reasoning process
 * as a tree structure. Each node in the tree represents a thought, observation, action,
 * or conclusion in the reasoning process.
 */

export type NodeType = 'query' | 'thought' | 'action' | 'observation' | 'conclusion' | 'error';

/**
 * Interface for a single node in the reasoning tree
 */
export interface ReasoningNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  depth: number;
  children?: ReasoningNode[];
  expanded?: boolean;
}

/**
 * Interface for the complete reasoning tree
 */
export interface ReasoningTree {
  id: string;
  rootNode: ReasoningNode;
  nodes: Map<string, ReasoningNode>;
  timestamp: number;
  metadata?: {
    queryText?: string;
    executionTime?: number;
    success?: boolean;
    mode?: string;
    [key: string]: any;
  };
}

/**
 * Interface for the reasoning tree visualization configuration
 */
export interface TreeVisualizationConfig {
  showTimestamps: boolean;
  expandAll: boolean;
  highlightPath: boolean;
  zoomLevel: number;
  layout: 'vertical' | 'horizontal' | 'radial';
  theme: 'default' | 'light' | 'dark' | 'colorful';
}

/**
 * Mock data generator for testing the visualization
 */
export function generateMockReasoningTree(): ReasoningTree {
  // Create a root query node
  const rootNode: ReasoningNode = {
    id: '1',
    parentId: null,
    type: 'query',
    content: 'How do I implement a binary search algorithm in JavaScript?',
    timestamp: Date.now(),
    depth: 0,
    expanded: true,
  };
  
  // Create a tree structure with this node
  const tree: ReasoningTree = {
    id: `tree-${Date.now()}`,
    rootNode,
    nodes: new Map([['1', rootNode]]),
    timestamp: Date.now(),
    metadata: {
      queryText: 'How do I implement a binary search algorithm in JavaScript?',
      executionTime: 2500,
      success: true,
      mode: 'step-by-step',
    },
  };
  
  // Add some thoughts
  const thought1: ReasoningNode = {
    id: '2',
    parentId: '1',
    type: 'thought',
    content: 'First, I need to understand what a binary search algorithm does. It searches for a target value in a sorted array by repeatedly dividing the search space in half.',
    timestamp: Date.now() + 100,
    depth: 1,
    expanded: true,
  };
  
  const thought2: ReasoningNode = {
    id: '3',
    parentId: '2',
    type: 'thought',
    content: 'I need to implement this using an iterative or recursive approach. Let\'s use an iterative approach for efficiency.',
    timestamp: Date.now() + 200,
    depth: 2,
    expanded: true,
  };
  
  // Add an action
  const action1: ReasoningNode = {
    id: '4',
    parentId: '3',
    type: 'action',
    content: 'Writing pseudocode for binary search',
    timestamp: Date.now() + 300,
    depth: 3,
    expanded: true,
  };
  
  // Add an observation
  const observation1: ReasoningNode = {
    id: '5',
    parentId: '4',
    type: 'observation',
    content: 'The algorithm needs to track left and right pointers, calculate the middle index, and compare the target with the middle element.',
    timestamp: Date.now() + 400,
    depth: 4,
    expanded: true,
  };
  
  // Add another thought
  const thought3: ReasoningNode = {
    id: '6',
    parentId: '5',
    type: 'thought',
    content: 'Now I can implement the binary search algorithm in JavaScript.',
    timestamp: Date.now() + 500,
    depth: 5,
    expanded: true,
  };
  
  // Add a conclusion
  const conclusion: ReasoningNode = {
    id: '7',
    parentId: '6',
    type: 'conclusion',
    content: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (arr[mid] === target) {
      return mid; // Target found, return its index
    }
    
    if (arr[mid] < target) {
      left = mid + 1; // Look in the right half
    } else {
      right = mid - 1; // Look in the left half
    }
  }
  
  return -1; // Target not found
}`,
    timestamp: Date.now() + 600,
    depth: 6,
    expanded: true,
  };
  
  // Add all nodes to the tree
  tree.nodes.set('2', thought1);
  tree.nodes.set('3', thought2);
  tree.nodes.set('4', action1);
  tree.nodes.set('5', observation1);
  tree.nodes.set('6', thought3);
  tree.nodes.set('7', conclusion);
  
  // Set up children references
  rootNode.children = [thought1];
  thought1.children = [thought2];
  thought2.children = [action1];
  action1.children = [observation1];
  observation1.children = [thought3];
  thought3.children = [conclusion];
  
  return tree;
}

/**
 * Utility function to convert a flat list of nodes into a tree structure
 */
export function buildTreeFromNodes(nodes: ReasoningNode[]): ReasoningTree | null {
  if (!nodes.length) return null;
  
  // Create a map for quick lookup
  const nodeMap = new Map<string, ReasoningNode>();
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });
  
  // Find the root node (has null parentId)
  const rootNode = nodes.find(node => node.parentId === null);
  if (!rootNode) return null;
  
  // Build the tree structure
  nodes.forEach(node => {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(nodeMap.get(node.id)!);
      }
    }
  });
  
  return {
    id: `tree-${Date.now()}`,
    rootNode: nodeMap.get(rootNode.id)!,
    nodes: nodeMap,
    timestamp: Date.now(),
  };
}

/**
 * Function to find a specific node in the tree
 */
export function findNodeInTree(tree: ReasoningTree, nodeId: string): ReasoningNode | null {
  return tree.nodes.get(nodeId) || null;
}

/**
 * Function to get the path from root to a specific node
 */
export function getPathToNode(tree: ReasoningTree, nodeId: string): ReasoningNode[] {
  const path: ReasoningNode[] = [];
  let currentNode = tree.nodes.get(nodeId);
  
  while (currentNode) {
    path.unshift(currentNode);
    if (currentNode.parentId) {
      currentNode = tree.nodes.get(currentNode.parentId);
    } else {
      break;
    }
  }
  
  return path;
} 
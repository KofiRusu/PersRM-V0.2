import { ReasoningNode, ReasoningTree, NodeType, buildTreeFromNodes } from '@/components/reasoning-assistant/models/ReasoningTreeTypes';
import { retentionService } from './retention';

/**
 * ReasoningTreeService
 * 
 * This service is responsible for creating, managing, and storing reasoning trees.
 * It tracks the reasoning process of the assistant and provides methods to visualize
 * and interact with the reasoning tree.
 */
class ReasoningTreeService {
  private currentTree: ReasoningTree | null = null;
  private trees: Map<string, ReasoningTree> = new Map();
  private isInitialized: boolean = false;
  private autoSaveEnabled: boolean = true;
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Load saved trees
    this.loadTrees();
    
    // Log initialization
    retentionService.trackEvent('reasoning-tree-service-initialized', {
      treeCount: this.trees.size,
    });
    
    this.isInitialized = true;
  }
  
  /**
   * Create a new reasoning tree
   */
  public createTree(queryText: string, metadata?: Record<string, any>): ReasoningTree {
    const rootNode: ReasoningNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      parentId: null,
      type: 'query',
      content: queryText,
      timestamp: Date.now(),
      depth: 0,
      expanded: true,
    };
    
    const tree: ReasoningTree = {
      id: `tree-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      rootNode,
      nodes: new Map([[rootNode.id, rootNode]]),
      timestamp: Date.now(),
      metadata: {
        queryText,
        ...metadata,
      },
    };
    
    this.trees.set(tree.id, tree);
    this.currentTree = tree;
    
    // Log tree creation
    retentionService.trackEvent('reasoning-tree-created', {
      treeId: tree.id,
      query: queryText,
    });
    
    // Auto-save
    if (this.autoSaveEnabled) {
      this.saveTrees();
    }
    
    return tree;
  }
  
  /**
   * Add a node to the current tree
   */
  public addNode(
    parentId: string,
    type: NodeType,
    content: string,
    metadata?: Record<string, any>
  ): ReasoningNode | null {
    if (!this.currentTree) return null;
    
    const parent = this.currentTree.nodes.get(parentId);
    if (!parent) return null;
    
    // Create new node
    const node: ReasoningNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      parentId,
      type,
      content,
      metadata,
      timestamp: Date.now(),
      depth: parent.depth + 1,
      expanded: true,
      children: [],
    };
    
    // Add to nodes map
    this.currentTree.nodes.set(node.id, node);
    
    // Add to parent's children
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);
    
    // Log node creation
    retentionService.trackEvent('reasoning-tree-node-added', {
      treeId: this.currentTree.id,
      nodeId: node.id,
      type,
      parentId,
    });
    
    // Auto-save
    if (this.autoSaveEnabled) {
      this.saveTrees();
    }
    
    return node;
  }
  
  /**
   * Get the current tree
   */
  public getCurrentTree(): ReasoningTree | null {
    return this.currentTree;
  }
  
  /**
   * Set the current tree
   */
  public setCurrentTree(treeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (tree) {
      this.currentTree = tree;
      return true;
    }
    return false;
  }
  
  /**
   * Get a tree by ID
   */
  public getTree(treeId: string): ReasoningTree | null {
    return this.trees.get(treeId) || null;
  }
  
  /**
   * Get all trees
   */
  public getAllTrees(): ReasoningTree[] {
    return Array.from(this.trees.values())
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending
  }
  
  /**
   * Delete a tree
   */
  public deleteTree(treeId: string): boolean {
    const success = this.trees.delete(treeId);
    
    if (success) {
      // If deleted tree was the current tree, set current tree to null
      if (this.currentTree && this.currentTree.id === treeId) {
        this.currentTree = null;
      }
      
      // Log tree deletion
      retentionService.trackEvent('reasoning-tree-deleted', {
        treeId,
      });
      
      // Auto-save
      if (this.autoSaveEnabled) {
        this.saveTrees();
      }
    }
    
    return success;
  }
  
  /**
   * Toggle a node's expanded state
   */
  public toggleNodeExpanded(treeId: string, nodeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;
    
    const node = tree.nodes.get(nodeId);
    if (!node) return false;
    
    node.expanded = !node.expanded;
    
    // Log toggle action
    retentionService.trackEvent('reasoning-tree-node-toggled', {
      treeId,
      nodeId,
      expanded: node.expanded,
    });
    
    // Auto-save
    if (this.autoSaveEnabled) {
      this.saveTrees();
    }
    
    return true;
  }
  
  /**
   * Expand all nodes in a tree
   */
  public expandAll(treeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;
    
    for (const node of tree.nodes.values()) {
      node.expanded = true;
    }
    
    // Log expand all action
    retentionService.trackEvent('reasoning-tree-expand-all', {
      treeId,
    });
    
    // Auto-save
    if (this.autoSaveEnabled) {
      this.saveTrees();
    }
    
    return true;
  }
  
  /**
   * Collapse all nodes in a tree
   */
  public collapseAll(treeId: string): boolean {
    const tree = this.trees.get(treeId);
    if (!tree) return false;
    
    // Keep root expanded, collapse the rest
    for (const node of tree.nodes.values()) {
      node.expanded = node.parentId === null;
    }
    
    // Log collapse all action
    retentionService.trackEvent('reasoning-tree-collapse-all', {
      treeId,
    });
    
    // Auto-save
    if (this.autoSaveEnabled) {
      this.saveTrees();
    }
    
    return true;
  }
  
  /**
   * Save trees to localStorage
   */
  private saveTrees(): void {
    try {
      // Convert Map to array of arrays for serialization
      const serializedTrees = Array.from(this.trees.entries()).map(([id, tree]) => {
        // Convert nodes Map to array of arrays
        const serializedNodes = Array.from(tree.nodes.entries());
        
        // Return serializable tree object
        return [
          id,
          {
            ...tree,
            nodes: serializedNodes,
          },
        ];
      });
      
      localStorage.setItem('reasoning-trees', JSON.stringify(serializedTrees));
    } catch (error) {
      console.error('Error saving reasoning trees:', error);
    }
  }
  
  /**
   * Load trees from localStorage
   */
  private loadTrees(): void {
    try {
      const savedTrees = localStorage.getItem('reasoning-trees');
      
      if (savedTrees) {
        const treesArray = JSON.parse(savedTrees) as [string, any][];
        
        treesArray.forEach(([id, serializedTree]) => {
          // Convert nodes array back to Map
          const nodesMap = new Map(serializedTree.nodes);
          
          // Reconstruct tree with proper Maps
          const tree: ReasoningTree = {
            ...serializedTree,
            nodes: nodesMap,
          };
          
          this.trees.set(id, tree);
        });
        
        // Set current tree to the most recent one if available
        if (this.trees.size > 0) {
          const mostRecentTree = Array.from(this.trees.values())
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          
          this.currentTree = mostRecentTree;
        }
      }
    } catch (error) {
      console.error('Error loading reasoning trees:', error);
    }
  }
  
  /**
   * Import a reasoning tree from JSON
   */
  public importFromJson(jsonString: string): ReasoningTree | null {
    try {
      const data = JSON.parse(jsonString);
      const nodes: ReasoningNode[] = data.nodes || [];
      
      if (!nodes.length) return null;
      
      const tree = buildTreeFromNodes(nodes);
      if (tree) {
        this.trees.set(tree.id, tree);
        this.currentTree = tree;
        
        // Auto-save
        if (this.autoSaveEnabled) {
          this.saveTrees();
        }
        
        // Log import
        retentionService.trackEvent('reasoning-tree-imported', {
          treeId: tree.id,
          nodeCount: nodes.length,
        });
      }
      
      return tree;
    } catch (error) {
      console.error('Error importing reasoning tree:', error);
      return null;
    }
  }
  
  /**
   * Export a reasoning tree to JSON
   */
  public exportToJson(treeId: string): string | null {
    const tree = this.trees.get(treeId);
    if (!tree) return null;
    
    try {
      // Convert nodes Map to array
      const nodes = Array.from(tree.nodes.values());
      
      // Create exportable data
      const exportData = {
        id: tree.id,
        timestamp: tree.timestamp,
        metadata: tree.metadata,
        nodes,
      };
      
      // Log export
      retentionService.trackEvent('reasoning-tree-exported', {
        treeId: tree.id,
        nodeCount: nodes.length,
      });
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting reasoning tree:', error);
      return null;
    }
  }
}

// Export singleton instance
export const reasoningTreeService = new ReasoningTreeService();
export default reasoningTreeService; 
export interface GraphNode {
  id: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

export interface GraphData {
  directed?: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface IndexedEdge {
  target: string;
  type?: string;
  direction: "out" | "in";
}

export interface GraphIndex {
  byId: Map<string, GraphNode>;
  byLabel: Map<string, GraphNode[]>;
  adjacency: Map<string, IndexedEdge[]>;
  nodeCount: number;
  edgeCount: number;
}

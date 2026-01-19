import { useState, useMemo, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import type { Skill, TreeNode } from "./types.js";

interface TreeSelectProps {
  nodes: TreeNode[];
  onSubmit: (selected: Skill[]) => void;
  onCancel: () => void;
}

export interface FlatNode {
  node: TreeNode;
  depth: number;
  parentId?: string;
}

export function flattenNodes(nodes: TreeNode[], expanded: Set<string>, depth = 0, parentId?: string): FlatNode[] {
  const result: FlatNode[] = [];

  for (const node of nodes) {
    result.push({ node, depth, parentId });

    if (node.children && node.children.length > 0 && expanded.has(node.id)) {
      result.push(...flattenNodes(node.children, expanded, depth + 1, node.id));
    }
  }

  return result;
}

export function countSelected(node: TreeNode, selected: Set<string>): { selected: number; total: number } {
  if (node.skill) {
    return { selected: selected.has(node.id) ? 1 : 0, total: 1 };
  }

  let total = 0;
  let selectedCount = 0;

  for (const child of node.children || []) {
    const counts = countSelected(child, selected);
    total += counts.total;
    selectedCount += counts.selected;
  }

  return { selected: selectedCount, total };
}

export function getAllSkillIds(node: TreeNode): string[] {
  if (node.skill) {
    return [node.id];
  }

  const ids: string[] = [];
  for (const child of node.children || []) {
    ids.push(...getAllSkillIds(child));
  }
  return ids;
}

function TreeItem({
  node,
  depth,
  focused,
  isExpanded,
  isSelected,
  selectedCount,
  totalCount,
}: {
  node: TreeNode;
  depth: number;
  focused: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  selectedCount?: number;
  totalCount?: number;
}) {
  const indent = "  ".repeat(depth);
  const isCategory = !node.skill && node.children && node.children.length > 0;

  const prefix = isCategory ? (isExpanded ? "▼ " : "▶ ") : isSelected ? "☑ " : "☐ ";

  const focusIndicator = focused ? "│ " : "│ ";
  const labelColor = isCategory ? "blue" : "green";
  const focusColor = focused ? "cyan" : undefined;

  const countText =
    isCategory && selectedCount !== undefined && totalCount !== undefined
      ? ` (${selectedCount}/${totalCount})`
      : "";

  const hintText = node.hint ? ` - ${node.hint}` : "";

  return (
    <Box>
      <Text color={focusColor}>{focusIndicator}</Text>
      <Text>{indent}</Text>
      <Text color={labelColor}>
        {prefix}
        {node.label}
      </Text>
      {isCategory && (
        <Text dimColor>{countText}</Text>
      )}
      {!isCategory && node.hint && (
        <Text dimColor>{hintText}</Text>
      )}
    </Box>
  );
}

function TreeSelect({ nodes, onSubmit, onCancel }: TreeSelectProps) {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Start with all categories expanded
    const ids = new Set<string>();
    const collectCategoryIds = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (n.children && n.children.length > 0) {
          ids.add(n.id);
          collectCategoryIds(n.children);
        }
      }
    };
    collectCategoryIds(nodes);
    return ids;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleNodes = useMemo(() => flattenNodes(nodes, expanded), [nodes, expanded]);

  const currentNode = visibleNodes[cursor]?.node;

  const toggleExpand = useCallback(
    (nodeId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    []
  );

  const toggleSelect = useCallback(
    (node: TreeNode) => {
      if (node.skill) {
        // Toggle single skill
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      } else if (node.children) {
        // Toggle all skills in category
        const allIds = getAllSkillIds(node);
        setSelected((prev) => {
          const next = new Set(prev);
          const allSelected = allIds.every((id) => prev.has(id));
          if (allSelected) {
            // Deselect all
            for (const id of allIds) {
              next.delete(id);
            }
          } else {
            // Select all
            for (const id of allIds) {
              next.add(id);
            }
          }
          return next;
        });
      }
    },
    []
  );

  const selectAllInCategory = useCallback(() => {
    if (!currentNode) return;

    // Find the category this node belongs to (or is)
    let targetNode = currentNode;
    if (currentNode.skill) {
      // Find parent category
      const flat = visibleNodes[cursor];
      if (flat.parentId) {
        const parent = visibleNodes.find((f) => f.node.id === flat.parentId);
        if (parent) {
          targetNode = parent.node;
        }
      }
    }

    if (targetNode.children || !targetNode.skill) {
      const allIds = getAllSkillIds(targetNode);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of allIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [currentNode, cursor, visibleNodes]);

  const invertSelection = useCallback(() => {
    const allSkillIds: string[] = [];
    const collectAll = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (n.skill) {
          allSkillIds.push(n.id);
        } else if (n.children) {
          collectAll(n.children);
        }
      }
    };
    collectAll(nodes);

    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of allSkillIds) {
        if (!prev.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [nodes]);

  const handleSubmit = useCallback(() => {
    const selectedSkills: Skill[] = [];
    const collectSkills = (ns: TreeNode[]) => {
      for (const n of ns) {
        if (n.skill && selected.has(n.id)) {
          selectedSkills.push(n.skill);
        } else if (n.children) {
          collectSkills(n.children);
        }
      }
    };
    collectSkills(nodes);
    onSubmit(selectedSkills);
    exit();
  }, [nodes, selected, onSubmit, exit]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      exit();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => Math.min(visibleNodes.length - 1, c + 1));
      return;
    }

    if (key.rightArrow && currentNode?.children) {
      if (!expanded.has(currentNode.id)) {
        toggleExpand(currentNode.id);
      }
      return;
    }

    if (key.leftArrow && currentNode) {
      if (currentNode.children && expanded.has(currentNode.id)) {
        toggleExpand(currentNode.id);
      } else {
        // Navigate to parent
        const flat = visibleNodes[cursor];
        if (flat.parentId) {
          const parentIdx = visibleNodes.findIndex((f) => f.node.id === flat.parentId);
          if (parentIdx >= 0) {
            setCursor(parentIdx);
          }
        }
      }
      return;
    }

    if (input === " " && currentNode) {
      toggleSelect(currentNode);
      return;
    }

    if (input === "a" || input === "A") {
      selectAllInCategory();
      return;
    }

    if (input === "i" || input === "I") {
      invertSelection();
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }
  }, { isActive: true });

  if (visibleNodes.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">◆ Select skills to install:</Text>
        <Text dimColor>No skills available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">◆ Select skills to install:</Text>
      <Text>│</Text>
      {visibleNodes.map((flat, i) => {
        const isCategory = !flat.node.skill && flat.node.children && flat.node.children.length > 0;
        const counts = isCategory ? countSelected(flat.node, selected) : undefined;

        return (
          <TreeItem
            key={flat.node.id}
            node={flat.node}
            depth={flat.depth}
            focused={i === cursor}
            isExpanded={expanded.has(flat.node.id)}
            isSelected={selected.has(flat.node.id)}
            selectedCount={counts?.selected}
            totalCount={counts?.total}
          />
        );
      })}
      <Text>│</Text>
      <Text dimColor>│ ↑↓ navigate  →← expand/collapse  space select  a all  i invert  enter confirm</Text>
      <Text>└</Text>
    </Box>
  );
}

export async function treeSelect(nodes: TreeNode[]): Promise<Skill[]> {
  return new Promise((resolve, reject) => {
    const { unmount, waitUntilExit } = render(
      <TreeSelect
        nodes={nodes}
        onSubmit={(skills) => {
          resolve(skills);
        }}
        onCancel={() => {
          reject(new Error("Selection cancelled"));
        }}
      />
    );

    waitUntilExit().then(() => {
      unmount();
    });
  });
}

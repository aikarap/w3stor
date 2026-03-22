"use client";

import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { Bot, Trash2, Copy, Pencil, Play, HardDrive, Unplug } from "lucide-react";
import { workflowNodesAtom, workflowEdgesAtom, selectedNodeIdAtom } from "@/lib/workflow/atoms";
import type { AgentNodeData, TriggerNodeData, StorageNodeData, WorkflowNode } from "@/lib/workflow/types";

interface ContextMenuProps {
  x: number;
  y: number;
  /** If set, we right-clicked on a node */
  nodeId: string | null;
  /** Canvas position for adding nodes */
  canvasPosition: { x: number; y: number };
  onClose: () => void;
}

let idCounter = Date.now();
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

export function ContextMenu({ x, y, nodeId, canvasPosition, onClose }: ContextMenuProps) {
  const setNodes = useSetAtom(workflowNodesAtom);
  const setEdges = useSetAtom(workflowEdgesAtom);
  const setSelectedNodeId = useSetAtom(selectedNodeIdAtom);

  const addAgent = useCallback(() => {
    const id = nextId("agent");
    const newNode: WorkflowNode = {
      id,
      type: "agent",
      position: canvasPosition,
      style: { width: 208, height: 140 },
      data: {
        type: "agent",
        label: "New Agent",
        role: "Describe this agent's task",
        modelId: "gpt-4o",
        prompt: "",
        status: "idle",
      } as AgentNodeData,
    };
    setNodes((prev) => [...prev, newNode]);
    onClose();
  }, [canvasPosition, setNodes, onClose]);

  const addTrigger = useCallback(() => {
    const id = nextId("trigger");
    const newNode: WorkflowNode = {
      id,
      type: "trigger",
      position: canvasPosition,
      style: { width: 144, height: 144 },
      data: { type: "trigger", label: "Start", triggerType: "manual", status: "idle" } as TriggerNodeData,
    };
    setNodes((prev) => [...prev, newNode]);
    onClose();
  }, [canvasPosition, setNodes, onClose]);

  const addStorage = useCallback(() => {
    const id = nextId("storage");
    const newNode: WorkflowNode = {
      id,
      type: "storage",
      position: canvasPosition,
      style: { width: 144, height: 144 },
      data: { type: "storage", label: "Store on Filecoin", status: "idle" } as StorageNodeData,
    };
    setNodes((prev) => [...prev, newNode]);
    onClose();
  }, [canvasPosition, setNodes, onClose]);

  const deleteNode = useCallback(() => {
    if (!nodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
    onClose();
  }, [nodeId, setNodes, setEdges, setSelectedNodeId, onClose]);

  const duplicateNode = useCallback(() => {
    if (!nodeId) return;
    setNodes((prev) => {
      const original = prev.find((n) => n.id === nodeId);
      if (!original) return prev;
      const id = nextId(original.type ?? "node");
      const clone: WorkflowNode = {
        ...original,
        id,
        position: { x: original.position.x + 40, y: original.position.y + 40 },
        data: { ...original.data, label: `${original.data.label} (copy)`, status: "idle" },
      };
      return [...prev, clone];
    });
    onClose();
  }, [nodeId, setNodes, onClose]);

  const editNode = useCallback(() => {
    if (!nodeId) return;
    setSelectedNodeId(nodeId);
    onClose();
  }, [nodeId, setSelectedNodeId, onClose]);

  const disconnectNode = useCallback(() => {
    if (!nodeId) return;
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    onClose();
  }, [nodeId, setEdges, onClose]);

  // Menu items based on context
  const isNodeMenu = !!nodeId;

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

      {/* Menu */}
      <div
        className="fixed z-50 min-w-48 rounded-xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl"
        style={{ left: x, top: y }}
      >
        {isNodeMenu ? (
          <>
            <MenuItem icon={Pencil} label="Edit Config" onClick={editNode} />
            <MenuItem icon={Copy} label="Duplicate" onClick={duplicateNode} />
            <MenuItem icon={Unplug} label="Disconnect Edges" onClick={disconnectNode} />
            <div className="my-1 border-t border-border/40" />
            <MenuItem icon={Trash2} label="Delete" onClick={deleteNode} variant="danger" />
          </>
        ) : (
          <>
            <MenuItem icon={Bot} label="Add Agent" onClick={addAgent} />
            <MenuItem icon={Play} label="Add Trigger" onClick={addTrigger} />
            <MenuItem icon={HardDrive} label="Add Storage Node" onClick={addStorage} />
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        variant === "danger"
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

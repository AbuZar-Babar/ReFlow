'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Drawflow, { DrawflowNode, DrawflowConnection } from 'drawflow';
import './drawflow-theme.css';
import {
  StepActionType,
  StepNodeData,
  renderNodeHtml,
  createDefaultStepData,
} from './CustomNodes';
import PropertyDrawer from './PropertyDrawer';
import { TakeTourButton } from '@/components/tour/TakeTourButton';
import { useDashboard } from '@/context/DashboardContext';
import { Workflow } from '@/lib/types/database';
import { ExecutionPreflightModal } from '@/components/dashboard/ExecutionPreflightModal';
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MousePointer,
  Keyboard,
  ListFilter,
  Compass,
  Clock,
  Repeat,
  Database,
  Download,
  Loader2,
  Workflow as WorkflowIcon,
} from 'lucide-react';

interface VisualWorkflowEditorProps {
  workflowId: string;
}

interface LoadedStepCandidate {
  value?: string;
  strategy?: string;
  priority?: number;
  uniqueness?: number;
}

interface LoadedStepRecord {
  name?: string;
  action?: string;
  type?: string;
  target?: string | Record<string, unknown>;
  candidates?: string[] | LoadedStepCandidate[];
  rawTarget?: Record<string, unknown> | null;
  value?: string | number;
  timeout_ms?: number;
  is_idempotent?: boolean;
  role?: 'SETUP' | 'LOOP';
  extract_column?: string;
  column?: string;
  extract_attribute?: string;
  attribute?: string;
  download_dir?: string;
  upload_to_cloud?: boolean;
  isCheckbox?: boolean;
  desiredState?: boolean;
  checked?: boolean;
  isUncheck?: boolean;
  isLoop?: boolean;
  loopMode?: string;
  options?: Array<{ value: string; label: string }> | string[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface LoadedWorkflowRecord {
  id?: string;
  name?: string;
  portal_url?: string;
  workflow_definition?: {
    drawflow?: unknown;
    steps?: LoadedStepRecord[];
    [key: string]: unknown;
  };
  filter_rules?: Record<string, unknown>;
}

export default function VisualWorkflowEditor({ workflowId }: VisualWorkflowEditorProps) {
  const { isRunnerOnline, orgId } = useDashboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Drawflow | null>(null);

  const [workflowName, setWorkflowName] = useState<string>('Workflow Canvas');
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isPreflightOpen, setIsPreflightOpen] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [runMessage, setRunMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [stepListVersion, setStepListVersion] = useState<number>(0);
  const [filterRules, setFilterRules] = useState<Record<string, unknown>>({});

  // Property Drawer State
  const [selectedNodeId, setSelectedNodeId] = useState<string | number | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<StepNodeData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Ref to track selectedNodeId for event listener cleanup without re-attaching
  const selectedNodeIdRef = useRef<string | number | null>(selectedNodeId);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // Palette State
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  // Update step numbers sequentially in the DOM and apply loop anchor classes
  const refreshStepVisuals = useCallback(() => {
    if (!editorRef.current) return;
    try {
      const exportData = editorRef.current.export();
      const nodes: Record<string, DrawflowNode> = (exportData.drawflow.Home?.data || {}) as Record<string, DrawflowNode>;
      const nodeKeys = Object.keys(nodes);

      // Sort nodes by X position to follow execution flow
      const sortedKeys = [...nodeKeys].sort((a, b) => (nodes[a]?.pos_x || 0) - (nodes[b]?.pos_x || 0));

      let activeLoopIndex = -1;
      sortedKeys.forEach((key, index) => {
        const d = (nodes[key]?.data || {}) as StepNodeData;
        const isLoop = d.role === 'LOOP' || d.isLoop === true || d.action === 'LOOP_START';
        if (isLoop && activeLoopIndex === -1) {
          activeLoopIndex = index;
        }
      });

      sortedKeys.forEach((key, index) => {
        const node = nodes[key];
        const domNode = document.getElementById(`node-${key}`);
        if (domNode && node && node.data) {
          const stepData = node.data as StepNodeData;
          stepData.stepIndex = index;

          const isLoop = stepData.role === 'LOOP' || stepData.isLoop === true || stepData.action === 'LOOP_START';
          const isLoopAnchor = isLoop && (index === activeLoopIndex);

          stepData.isLoopAnchor = isLoopAnchor;

          if (isLoopAnchor) {
            domNode.classList.add('is-loop-anchor');
            domNode.classList.remove('is-loop-node');
          } else if (isLoop) {
            domNode.classList.add('is-loop-node');
            domNode.classList.remove('is-loop-anchor');
          } else {
            domNode.classList.remove('is-loop-anchor');
            domNode.classList.remove('is-loop-node');
          }

          const contentElem = domNode.querySelector('.drawflow_content_node');
          if (contentElem) {
            contentElem.innerHTML = renderNodeHtml(stepData, isLoopAnchor);
          }
        }
      });
      setStepListVersion((version) => version + 1);
    } catch (err) {
      console.warn('refreshStepVisuals error:', err);
    }
  }, []);

  // Topological compiler to order nodes into execution steps
  const compileTopologicalSteps = useCallback(() => {
    if (!editorRef.current) return { steps: [], hasLoop: false, loopStepIndex: -1 };

    const exported = editorRef.current.export();
    const nodes: Record<string, DrawflowNode> = (exported.drawflow.Home?.data || {}) as Record<string, DrawflowNode>;
    const nodeEntries = Object.entries(nodes);

    if (nodeEntries.length === 0) {
      return { steps: [], hasLoop: false, loopStepIndex: -1 };
    }

    // Identify entry nodes (0 input connections)
    const entryNodes = nodeEntries.filter(([, n]) => {
      const inputConns = n.inputs?.input_1?.connections || [];
      return inputConns.length === 0;
    });

    const orderedNodes: Array<{ id: string; data: StepNodeData; pos_x: number }> = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const n = nodes[nodeId];
      if (!n) return;

      orderedNodes.push({ id: nodeId, data: n.data as StepNodeData, pos_x: n.pos_x });

      const outputConns: DrawflowConnection[] = (n.outputs?.output_1?.connections || []) as DrawflowConnection[];
      outputConns.forEach((conn: DrawflowConnection) => {
        if (conn.node && !visited.has(String(conn.node))) {
          traverse(String(conn.node));
        }
      });
    };

    if (entryNodes.length > 0) {
      // Sort entry nodes left to right
      entryNodes.sort((a, b) => a[1].pos_x - b[1].pos_x);
      entryNodes.forEach(([id]) => traverse(id));
    }

    // Append any unconnected nodes sorted by pos_x
    nodeEntries
      .filter(([id]) => !visited.has(id))
      .sort((a, b) => a[1].pos_x - b[1].pos_x)
      .forEach(([id]) => traverse(id));

    let firstLoopIdx = -1;
    const compiledSteps = orderedNodes.map((item, idx) => {
      const d = item.data || {};
      const action = (d.action || 'CLICK').toUpperCase() as StepActionType;
      const isLoop = d.role === 'LOOP' || action === 'LOOP_START' || action === 'EXTRACT_TABLE' || action === 'EXTRACT_TEXT';

      if (isLoop && firstLoopIdx === -1) {
        firstLoopIdx = idx;
      }

      const rawTarget = (d.rawTarget && typeof d.rawTarget === 'object') ? (d.rawTarget as Record<string, unknown>) : null;
      const candidateList: string[] = Array.isArray(d.candidates) ? d.candidates : [];

      let targetPayload: unknown = d.target || '';
      if (rawTarget) {
        targetPayload = {
          ...rawTarget,
          selector: d.target || (rawTarget as Record<string, unknown>).selector || '',
          candidates: candidateList.length > 0
            ? candidateList.map((c, cIdx) => {
                const existing = Array.isArray((rawTarget as Record<string, unknown>).candidates)
                  ? ((rawTarget as Record<string, unknown>).candidates as Array<Record<string, unknown>>).find((cand) => cand && cand.value === c)
                  : null;
                return existing || {
                  strategy: c.startsWith('//') || c.startsWith('(') ? 'xpath' : 'css-path',
                  value: c,
                  priority: cIdx + 1,
                  uniqueness: 1,
                };
              })
            : (rawTarget as Record<string, unknown>).candidates || [],
        };
      } else if (candidateList.length > 0) {
        targetPayload = {
          selector: d.target || '',
          candidates: candidateList.map((c, cIdx) => ({
            strategy: c.startsWith('//') || c.startsWith('(') ? 'xpath' : 'css-path',
            value: c,
            priority: cIdx + 1,
            uniqueness: 1,
          })),
          fingerprint: { tagName: null },
        };
      }

      const isCb = Boolean(
        d.isCheckbox === true ||
        d.desiredState !== undefined ||
        d.checked !== undefined ||
        (rawTarget && (rawTarget as Record<string, unknown>).isCheckbox) ||
        (d.name && d.name.toLowerCase().includes('checkbox'))
      );

      const desiredState = d.isUncheck === true
        ? false
        : (d.desiredState !== undefined
          ? Boolean(d.desiredState)
          : (d.checked !== undefined ? Boolean(d.checked) : true));

      return {
        index: idx,
        name: d.name || `Step #${idx + 1}`,
        action,
        type: action,
        target: targetPayload,
        candidates: candidateList,
        rawTarget,
        value: d.value || '',
        timeout_ms: Number(d.timeout_ms) || 5000,
        is_idempotent: Boolean(d.is_idempotent ?? isCb),
        role: d.role || (action === 'LOOP_START' ? 'LOOP' : 'SETUP'),
        isLoop,
        loopMode: d.loopMode || (isLoop ? 'sequential_iteration' : null),
        isLoopCandidate: isLoop,
        ...(isCb ? {
          isCheckbox: true,
          desiredState,
          checked: desiredState,
          isUncheck: !desiredState,
        } : {}),
        ...(Array.isArray(d.options) ? { options: d.options } : {}),
        ...(d.extract_column ? { extract_column: d.extract_column, extract_attribute: d.extract_attribute } : {}),
        ...(d.download_dir ? { download_dir: d.download_dir, upload_to_cloud: d.upload_to_cloud } : {}),
        ...(d.fieldName ? { fieldName: d.fieldName } : {}),
        ...(d.columnName ? { columnName: d.columnName } : {}),
        ...(d.sampleValue !== undefined ? { sampleValue: d.sampleValue } : {}),
      };
    });

    const hasTableExtract = compiledSteps.some(s => s.action === 'EXTRACT_TABLE' || (s as Record<string, unknown>).type === 'EXTRACT_TABLE');
    return {
      steps: compiledSteps,
      hasLoop: firstLoopIdx >= 0 || hasTableExtract,
      loopStepIndex: firstLoopIdx >= 0 ? firstLoopIdx : (hasTableExtract ? compiledSteps.findIndex(s => s.action === 'EXTRACT_TABLE') : -1),
    };
  }, []);

  // Save workflow to Supabase via PATCH API
  const handleSaveToCloud = async () => {
    if (!editorRef.current || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const exportedGraph = editorRef.current.export();
      const { steps, hasLoop, loopStepIndex } = compileTopologicalSteps();

      const payload = {
        workflow_id: workflowId,
        name: workflowName,
        portal_url: portalUrl || 'https://example.com',
        workflow_definition: {
          drawflow: exportedGraph,
          steps,
          actions: steps,
          start_url: portalUrl,
          mode: hasLoop ? 'loop' : 'single',
          isLoop: hasLoop,
          loopStepIndex: hasLoop && loopStepIndex >= 0 ? loopStepIndex : null,
          filter_rules: filterRules || {},
        },
        filter_rules: filterRules || {},
      };

      const res = await fetch(`/api/v1/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback to /api/v1/workflows if [id] route is not available
        const fallbackRes = await fetch(`/api/v1/workflows`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json();
          throw new Error(errData.error || 'Failed to save workflow');
        }
      }

      setIsDirty(false);
      setSaveMessage({ text: 'Workflow saved to cloud!', type: 'success' });
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving workflow';
      setSaveMessage({ text: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Run workflow opens preflight so users can choose single or batch/filter execution.
  const handleRunNow = () => {
    setIsPreflightOpen(true);
  };

  // Add a new step node from palette
  const handleAddStep = (actionType: StepActionType) => {
    if (!editorRef.current) return;

    const exportData = editorRef.current.export();
    const existingNodes: Record<string, DrawflowNode> = (exportData.drawflow.Home?.data || {}) as Record<string, DrawflowNode>;
    const nodeCount = Object.keys(existingNodes).length;

    // Find the rightmost node to position and auto-connect
    let maxPosX = 60;
    let lastNodeId: string | null = null;
    Object.entries(existingNodes).forEach(([id, node]) => {
      if (node.pos_x > maxPosX) {
        maxPosX = node.pos_x;
        lastNodeId = id;
      }
    });

    const newPosX = nodeCount === 0 ? 100 : maxPosX + 380;
    const newPosY = 180 + (nodeCount % 2) * 40;

    const stepData = createDefaultStepData(actionType, nodeCount);
    const html = renderNodeHtml(stepData);

    const newNodeId = editorRef.current.addNode(
      'step',
      1, // 1 input port
      1, // 1 output port
      newPosX,
      newPosY,
      'step-node',
      stepData,
      html
    );

    // Auto-connect to previous node
    if (lastNodeId) {
      try {
        editorRef.current.addConnection(lastNodeId, newNodeId, 'output_1', 'input_1');
      } catch (err) {
        console.warn('Auto connection error:', err);
      }
    }

    setIsPaletteOpen(false);
    markDirty();
    refreshStepVisuals();

    // Select the new node immediately in property drawer
    setSelectedNodeId(newNodeId);
    setSelectedNodeData(stepData);
    setIsDrawerOpen(true);
  };

  // Update step from PropertyDrawer
  const handleUpdateStep = (nodeId: string | number, updatedData: StepNodeData) => {
    if (!editorRef.current) return;

    editorRef.current.updateNodeDataFromId(nodeId, updatedData);

    // Re-render inner HTML in the canvas
    const domNode = document.getElementById(`node-${nodeId}`);
    if (domNode) {
      const contentElem = domNode.querySelector('.drawflow_content_node');
      if (contentElem) {
        contentElem.innerHTML = renderNodeHtml(updatedData);
      }
    }

    setSelectedNodeData(updatedData);
    markDirty();
    refreshStepVisuals();
  };

  // Delete node
  const handleDeleteNode = (nodeId: string | number) => {
    if (!editorRef.current) return;
    editorRef.current.removeNodeId(`node-${nodeId}`);
    if (selectedNodeId === nodeId) {
      setIsDrawerOpen(false);
      setSelectedNodeId(null);
      setSelectedNodeData(null);
    }
    markDirty();
    refreshStepVisuals();
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (editorRef.current) {
      editorRef.current.zoom_in();
      setZoomLevel(Math.round(editorRef.current.zoom * 100));
    }
  };

  const handleZoomOut = () => {
    if (editorRef.current) {
      editorRef.current.zoom_out();
      setZoomLevel(Math.round(editorRef.current.zoom * 100));
    }
  };

  const handleZoomReset = () => {
    if (editorRef.current) {
      editorRef.current.zoom_reset();
      setZoomLevel(100);
    }
  };

  // Initialize Drawflow canvas and load workflow
  useEffect(() => {
    if (!containerRef.current) return;

    let isSubscribed = true;

    // 1. Purge any stale canvas instances or DOM nodes
    if (editorRef.current) {
      try {
        editorRef.current.clear();
      } catch {}
      editorRef.current = null;
    }
    containerRef.current.innerHTML = '';

    // 2. Instantiate and start a single Drawflow canvas
    const editor = new Drawflow(containerRef.current);
    editor.reroute = true;
    editor.reroute_fix_curvature = true;
    editor.curvature = 0.5;
    editor.reroute_curvature_start_end = 0.5;
    editor.reroute_curvature = 0.5;
    editor.start();

    editorRef.current = editor;

    // Node selection events
    editor.on('nodeSelected', (rawId: unknown) => {
      const id = String(rawId);
      const exportData = editor.export();
      const node = exportData.drawflow.Home?.data[id];
      if (node) {
        setSelectedNodeId(id);
        setSelectedNodeData(node.data as StepNodeData);
        setIsDrawerOpen(true);
      }
    });

    editor.on('nodeCreated', () => markDirty());
    editor.on('nodeRemoved', () => markDirty());
    editor.on('connectionCreated', () => markDirty());
    editor.on('connectionRemoved', () => markDirty());

    // Delegated click handler on container for node delete button
    const container = containerRef.current;
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const deleteBtn = target.closest('[data-node-action="delete"]');
      if (deleteBtn) {
        e.stopPropagation();
        const parentNode = target.closest('.drawflow-node');
        if (parentNode && parentNode.id) {
          const rawId = parentNode.id.replace('node-', '');
          if (confirm('Delete this step?')) {
            try {
              editor.removeNodeId(parentNode.id);
            } catch (delErr) {
              console.warn('Step delete notice:', delErr);
            }
            const currentSelected = selectedNodeIdRef.current;
            if (currentSelected === rawId || currentSelected === Number(rawId)) {
              setIsDrawerOpen(false);
              setSelectedNodeId(null);
              setSelectedNodeData(null);
            }
            markDirty();
            refreshStepVisuals();
          }
        }
      }
    };
    container.addEventListener('click', handleContainerClick);

    // Fetch and load existing workflow
    const loadWorkflow = async () => {
      setIsLoading(true);
      try {
        let wfData: LoadedWorkflowRecord | null = null;

        // Try single workflow endpoint first
        const resSingle = await fetch(`/api/v1/workflows/${workflowId}`);
        if (resSingle.ok) {
          const json = await resSingle.json();
          wfData = json.workflow;
        } else {
          // Fallback to ?id= query param
          const resQuery = await fetch(`/api/v1/workflows?id=${encodeURIComponent(workflowId)}`);
          if (resQuery.ok) {
            const json = await resQuery.json();
            wfData = json.workflow || (json.workflows && json.workflows[0]);
          }
        }

        if (!isSubscribed) return;

        if (wfData) {
          setWorkflowName(wfData.name || 'Untitled Workflow');
          setPortalUrl(wfData.portal_url || '');
          setFilterRules(wfData.filter_rules || (wfData.workflow_definition as any)?.filter_rules || {});

          const def = wfData.workflow_definition || {};

          // Always ensure editor canvas is clean before importing or synthesizing
          try {
            editor.clear();
          } catch {}

          // Graph loading logic
          if (def.drawflow && typeof def.drawflow === 'object' && 'drawflow' in def.drawflow) {
            // Case 1: Existing visual Drawflow graph saved
            editor.import(def.drawflow);
            refreshStepVisuals();
          } else if (Array.isArray(def.steps) && def.steps.length > 0) {
            // Case 2: Synthesize Drawflow nodes from steps array
            const steps: LoadedStepRecord[] = def.steps;
            let prevNodeId: number | null = null;

            steps.forEach((step, idx) => {
              const act = (step.action || step.type || 'CLICK').toUpperCase() as StepActionType;
              const posX = 100 + idx * 380;
              const posY = 180 + (idx % 2) * 40;

              const targetSelector =
                typeof step.target === 'string'
                  ? step.target
                  : (step.target as Record<string, unknown>)?.selector as string || '';

              const rawTarget = typeof step.target === 'object' && step.target !== null
                ? (step.target as Record<string, unknown>)
                : (step.rawTarget || null);

              const candidateList: string[] = Array.isArray(step.candidates)
                ? (step.candidates as Array<string | LoadedStepCandidate>)
                    .map((c) => (typeof c === 'string' ? c : c.value || ''))
                    .filter((v: string) => v.length > 0)
                : typeof step.target === 'object' && step.target !== null && Array.isArray((step.target as Record<string, unknown>).candidates)
                ? ((step.target as Record<string, unknown>).candidates as Array<LoadedStepCandidate | string>)
                    .map((c) => (typeof c === 'string' ? c : c.value || ''))
                    .filter((v: string) => v.length > 0)
                : [];

              const isCb = Boolean(
                step.isCheckbox === true ||
                step.desiredState !== undefined ||
                step.checked !== undefined ||
                (rawTarget && (rawTarget as Record<string, unknown>).isCheckbox) ||
                (step.name && step.name.toLowerCase().includes('checkbox'))
              );

              const desiredState = step.isUncheck === true
                ? false
                : (step.desiredState !== undefined
                  ? Boolean(step.desiredState)
                  : (step.checked !== undefined ? Boolean(step.checked) : true));

              const isLoopStep = Boolean(step.role === 'LOOP' || step.isLoop || act === 'LOOP_START');

              const stepData: StepNodeData = {
                stepIndex: idx,
                name: step.name || `${act} Step #${idx + 1}`,
                action: act,
                target: targetSelector,
                candidates: candidateList,
                rawTarget: rawTarget as Record<string, unknown> | null,
                value: String(step.value ?? ''),
                timeout_ms: step.timeout_ms || 5000,
                is_idempotent: Boolean(step.is_idempotent ?? isCb),
                role: step.role || (isLoopStep ? 'LOOP' : 'SETUP'),
                isLoop: isLoopStep,
                loopMode: step.loopMode || (isLoopStep ? 'sequential_iteration' : undefined),
                isCheckbox: isCb,
                ...(isCb ? {
                  desiredState,
                  checked: desiredState,
                  isUncheck: !desiredState,
                } : {}),
                options: Array.isArray(step.options)
                  ? (step.options as Array<{ value: string; label: string }>)
                  : Array.isArray((step.meta as Record<string, unknown> | undefined)?.options)
                  ? ((step.meta as Record<string, unknown>).options as Array<{ value: string; label: string }>)
                  : undefined,
                extract_column: step.extract_column || step.column || '',
                extract_attribute: step.extract_attribute || step.attribute || '',
                download_dir: step.download_dir || '',
                upload_to_cloud: Boolean(step.upload_to_cloud),
              };

              const html = renderNodeHtml(stepData);
              const nodeId = editor.addNode('step', 1, 1, posX, posY, 'step-node', stepData, html);

              if (prevNodeId !== null) {
                editor.addConnection(prevNodeId, nodeId, 'output_1', 'input_1');
              }
              prevNodeId = nodeId;
            });

            refreshStepVisuals();
          }
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Error loading workflow:', err);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    loadWorkflow();

    return () => {
      isSubscribed = false;
      container.removeEventListener('click', handleContainerClick);
      if (editorRef.current) {
        try {
          editorRef.current.clear();
        } catch {}
        editorRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [workflowId, markDirty, refreshStepVisuals]);

  // Window beforeunload prompt when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const preflightCompiled = isPreflightOpen ? compileTopologicalSteps() : null;
  const exportedCanvasNodes = editorRef.current?.export().drawflow.Home?.data as Record<string, DrawflowNode> | undefined;
  const orderedCanvasNodes = Object.entries(exportedCanvasNodes || {}).sort(([, a], [, b]) => (a.pos_x || 0) - (b.pos_x || 0));
  // stepListVersion intentionally triggers a render after graph mutations.
  void stepListVersion;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#060913] text-slate-100 antialiased select-none">
      {/* ===================================================================
          Top Navigation Bar
          =================================================================== */}
      <header data-tour="canvas-header" className="z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 md:px-6 backdrop-blur-md">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/dashboard/workflows"
            onClick={(e) => {
              if (isDirty && !confirm('You have unsaved changes. Leave without saving?')) {
                e.preventDefault();
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            title="Back to Workflows"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workflowName}
                onChange={(e) => {
                  setWorkflowName(e.target.value);
                  markDirty();
                }}
                placeholder="Workflow Name"
                className="bg-transparent font-bold text-sm md:text-base text-white hover:border-b hover:border-slate-700 focus:border-b focus:border-emerald-500 focus:outline-none transition max-w-[240px] md:max-w-md truncate"
              />
              {isDirty && (
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
              )}
            </div>

            {portalUrl && (
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px] md:max-w-xs">
                {portalUrl}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <TakeTourButton variant="icon" tourId="canvas" />

          {/* Save to Cloud Button */}
          <button
            onClick={handleSaveToCloud}
            disabled={isSaving}
            data-tour="canvas-save"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              isDirty
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500'
                : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          {/* Run Now Button */}
          <button
            onClick={handleRunNow}
            disabled={isSaving}
            data-tour="canvas-run"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            Run workflow
          </button>
        </div>
      </header>

      {/* Floating Status Notification Banners */}
      {saveMessage && (
        <div
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md transition ${
            saveMessage.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-950/80 text-emerald-300'
              : 'border border-red-500/30 bg-red-950/80 text-red-300'
          }`}
        >
          {saveMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {runMessage && (
        <div
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md transition ${
            runMessage.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-950/80 text-emerald-300'
              : 'border border-red-500/30 bg-red-950/80 text-red-300'
          }`}
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{runMessage.text}</span>
        </div>
      )}

      {/* ===================================================================
          Main Editor Canvas Area
          =================================================================== */}
      <main className="relative flex min-h-0 flex-1 w-full overflow-hidden bg-[#0B1220]">
        {/* Workflow step navigator */}
        <aside data-tour="canvas-steps" className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-slate-800 bg-[#0F172A] px-3 py-5">
          <div className="mb-4 px-2">
            <h2 className="text-xs font-semibold tracking-wide text-slate-200">Workflow steps</h2>
            <p className="mt-1 text-xs text-slate-500">Select a step to edit it.</p>
          </div>
          <div className="reflow-hide-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto">
            {orderedCanvasNodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-3 py-5 text-center">
                <Plus className="mx-auto h-5 w-5 text-slate-500" />
                <p className="mt-2 text-xs font-medium text-slate-300">Start with a step</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Add an action to begin building your workflow.</p>
              </div>
            ) : orderedCanvasNodes.map(([nodeKey, node], index) => {
              const step = node.data as StepNodeData;
              const selected = String(selectedNodeId) === nodeKey;
              return (
                <button key={nodeKey} type="button" onClick={() => {
                  setSelectedNodeId(nodeKey);
                  setSelectedNodeData(step);
                  setIsDrawerOpen(true);
                  const element = document.getElementById(`node-${nodeKey}`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }} className={`group flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-blue-500/70 bg-blue-500/10' : 'border-transparent hover:border-slate-700 hover:bg-slate-800/70'}`}>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${selected ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-medium ${selected ? 'text-white' : 'text-slate-200'}`}>{step.name || step.action || 'Workflow step'}</span>
                    <span className="mt-1 block truncate text-[11px] text-slate-500">{String(step.action || 'Action').replaceAll('_', ' ').toLowerCase()}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              data-tour="canvas-add-step"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a step
            </button>

            {/* Dropdown Menu */}
            {isPaletteOpen && (
              <div
                className="reflow-hide-scrollbar absolute bottom-full right-0 mb-2 max-h-[min(68vh,520px)] w-56 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 text-xs"
                onClick={() => setIsPaletteOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Standard Actions
                </div>
                <button
                  onClick={() => handleAddStep('CLICK')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <MousePointer className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Click Element</span>
                </button>
                <button
                  onClick={() => handleAddStep('TYPE')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Keyboard className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Type Text</span>
                </button>
                <button
                  onClick={() => handleAddStep('SELECT')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <ListFilter className="h-3.5 w-3.5 text-purple-400" />
                  <span>Select Option</span>
                </button>
                <button
                  onClick={() => handleAddStep('NAVIGATE')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Compass className="h-3.5 w-3.5 text-sky-400" />
                  <span>Navigate URL</span>
                </button>
                <button
                  onClick={() => handleAddStep('WAIT')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Wait Timer</span>
                </button>

                <div className="my-1 border-t border-slate-800" />
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Automation & Loops
                </div>
                <button
                  onClick={() => handleAddStep('LOOP_START')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Repeat className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Loop Start</span>
                </button>
                <button
                  onClick={() => handleAddStep('EXTRACT')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Database className="h-3.5 w-3.5 text-teal-400" />
                  <span>Item Extraction</span>
                </button>
                <button
                  onClick={() => handleAddStep('DOWNLOAD')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>File Download</span>
                </button>
                <button
                  onClick={() => handleAddStep('EXTRACT_TEXT')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Extract Field to Excel</span>
                </button>
                <button
                  onClick={() => handleAddStep('EXTRACT_TABLE')}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800 text-slate-200 transition"
                >
                  <Repeat className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Scrape Table to Excel</span>
                </button>
              </div>
            )}
          </div>


          <p className="mt-3 px-2 text-[11px] text-slate-500">{orderedCanvasNodes.length} {orderedCanvasNodes.length === 1 ? 'step' : 'steps'}</p>
        </aside>
        <section className="relative min-w-0 flex-1 overflow-hidden bg-[#0B1220]">
          <div className="absolute left-4 top-4 z-10 hidden sm:block pointer-events-none" data-tour="canvas-stage">
            <h2 className="text-sm font-semibold text-slate-200">Workflow canvas</h2>
            <p className="mt-1 text-xs text-slate-500">Select a step to configure it.</p>
          </div>
        {/* Canvas zoom controls */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-1 py-1 text-slate-400 shadow-sm">
          <button
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800 hover:text-white transition"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-xs font-mono font-medium text-slate-300 min-w-[48px] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            onClick={handleZoomReset}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-800 hover:text-white transition"
            title="Reset Zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>


          {orderedCanvasNodes.length === 0 && !isLoading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
              <div className="max-w-sm rounded-2xl border border-slate-800 bg-[#111C2D]/95 p-6 text-center shadow-xl">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-cyan-300"><WorkflowIcon className="h-6 w-6" /></div>
                <h3 className="mt-4 text-sm font-semibold text-slate-100">Build your first workflow</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">Add a step from the left panel, then connect steps on the canvas to define what ReFlow should do.</p>
                <p className="mt-3 text-[11px] text-slate-500"><span className="text-cyan-300">Tip:</span> Start with a navigation step, then add the actions you perform in the browser.</p>
              </div>
            </div>
          )}
          {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#060913]/90 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <p className="mt-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Loading Workflow Canvas…
            </p>
          </div>
        )}

        {/* Drawflow DOM Container */}
        <div
          ref={containerRef}
          id="drawflow"
          className="parent-drawflow workflow-editor-canvas"
        />
        </section>

        {/* Step settings slide out only when a workflow step is selected. */}
        <div
          className={`absolute inset-y-0 right-0 z-30 w-[320px] max-w-[92vw] border-l border-slate-800 bg-[#0F172A] shadow-2xl transition-transform duration-200 ease-out ${isDrawerOpen && selectedNodeId !== null ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
          aria-hidden={!(isDrawerOpen && selectedNodeId !== null)}
        >
          <PropertyDrawer
            key={selectedNodeId !== null ? String(selectedNodeId) : 'none'}
            nodeId={selectedNodeId}
            nodeData={selectedNodeData}
            isOpen={isDrawerOpen && selectedNodeId !== null}
            onClose={() => { setIsDrawerOpen(false); setSelectedNodeId(null); setSelectedNodeData(null); }}
            onUpdate={handleUpdateStep}
            onDelete={handleDeleteNode}
          />
        </div>

        {/* Execution Preflight Modal */}
        {isPreflightOpen && (
          <ExecutionPreflightModal
            isOpen={isPreflightOpen}
            onClose={() => setIsPreflightOpen(false)}
            workflow={{
              id: workflowId,
              name: workflowName,
              portal_url: portalUrl,
              schema_version: '1.0.0',
              org_id: orgId || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              workflow_definition: {
                drawflow: editorRef.current ? editorRef.current.export() : undefined,
                steps: (preflightCompiled?.steps || []) as unknown as Array<Record<string, unknown>>,
                actions: (preflightCompiled?.steps || []) as unknown as Array<Record<string, unknown>>,
                mode: preflightCompiled?.hasLoop ? 'loop' : 'single',
                isLoop: Boolean(
                  preflightCompiled?.hasLoop ||
                  preflightCompiled?.steps.some(
                    (s) => s.action === 'LOOP_START' || (s.action as string) === 'EXTRACT_ITEMS' || s.action === 'EXTRACT_TABLE' || (s as unknown as Record<string, unknown>).isLoopAction === true
                  )
                ),
                loopStepIndex: (preflightCompiled?.loopStepIndex ?? -1) >= 0 ? preflightCompiled?.loopStepIndex : null,
              },
              filter_rules: filterRules || {},
            }}
            onRunDispatched={(run) => {
              setIsPreflightOpen(false);
              setRunMessage({
                text: `Run dispatched! Status: ${run.status} (Run ID: ${run.id?.slice(0, 8) || 'active'})`,
                type: 'success',
              });
              setTimeout(() => setRunMessage(null), 5000);
            }}
          />
        )}
      </main>
    </div>
  );
}

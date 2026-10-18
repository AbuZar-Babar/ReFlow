export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
  /** Matches a data-tour="..." attribute in the DOM. Omit for a centred card. */
  target?: string;
  title: string;
  /** What this thing is and why it matters. */
  body: string;
  /** Optional one-line instruction: what the user should actually do. */
  hint?: string;
  placement?: TourPlacement;
}

export interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
}

export const TOURS: Record<string, Tour> = {
  dashboard: {
    id: 'dashboard',
    name: 'Your workspace',
    steps: [
      {
        title: 'Welcome to ReFlow',
        body: 'This is your workspace. In about a minute you will know where everything lives and what each part does.',
        hint: 'Use Next and Back to move around. Esc leaves the tour at any point.',
        placement: 'center'
      },
      {
        target: 'sidebar',
        title: 'Your map',
        body: 'Everything in ReFlow lives in this rail. It collapses to icons to give your work more room, and it never goes away.',
        placement: 'right'
      },
      {
        target: 'nav-workflows',
        title: 'Workflows — the tasks you taught ReFlow',
        body: 'A workflow is one task you recorded once. This is where you go to start it again, or to change it.',
        placement: 'right'
      },
      {
        target: 'nav-runners',
        title: 'Desktop connection',
        body: 'ReFlow does not run in the cloud. It drives a browser on your own PC, through a small app called the worker. This page is where that app connects.',
        hint: 'If a run refuses to start, look here first.',
        placement: 'right'
      },
      {
        target: 'header-status',
        title: 'The connection light',
        body: 'Green means your PC is linked and ready. Grey means nothing can run right now — usually the desktop app is closed.',
        hint: 'This is the fastest way to diagnose a run that will not start.',
        placement: 'bottom'
      },
      {
        target: 'hero',
        title: 'Start here',
        body: 'Every task begins with a recording. You do the job once in Chrome while ReFlow watches, and it remembers the clicks and the fields.',
        hint: 'Press “Create a workflow” when you are ready to record your first one.',
        placement: 'bottom'
      },
      {
        target: 'metrics',
        title: 'The four numbers that matter',
        body: 'Workflows are the tasks you have saved. Runs are the times they executed. Success rate tells you whether they are holding up. Files collected is what came back out.',
        placement: 'bottom'
      },
      {
        target: 'recent-runs',
        title: 'Every execution, in order',
        body: 'Each row is one run. Click a row to see what it did step by step, including exactly where it failed if it did.',
        placement: 'top'
      },
      {
        target: 'nav-getting-started',
        title: 'That is the tour',
        body: 'Everything you just saw is written down in the getting-started guide, so you can come back to it whenever you need. This tour can be replayed from the ? button at the top right.',
        placement: 'right'
      }
    ]
  },

  workflows: {
    id: 'workflows',
    name: 'Workflows',
    steps: [
      {
        title: 'Your workflows',
        body: 'Each card on this page is one task you recorded. Three things worth knowing.',
        placement: 'center'
      },
      {
        target: 'wf-create',
        title: 'Record a new task',
        body: 'This opens a recording session in Chrome. Do the task once, the way you normally would, and save it.',
        hint: 'Clicking through to the next page while recording is how ReFlow learns to repeat for every item.',
        placement: 'bottom'
      },
      {
        target: 'wf-toolbar',
        title: 'Finding things later',
        body: 'Search by name or by the site it runs on. The filters below narrow by status once you have a few workflows.',
        placement: 'bottom'
      },
      {
        target: 'wf-list',
        title: 'Running a workflow',
        body: 'Press Run on any card to execute it. The card also shows the last run’s status, so you can tell at a glance whether it is healthy.',
        hint: 'The menu on each card holds edit and delete.',
        placement: 'top'
      }
    ]
  },

  runners: {
    id: 'runners',
    name: 'Desktop connection',
    steps: [
      {
        title: 'Connecting your PC',
        body: 'ReFlow runs your tasks on your own machine. Two things on this page do all the work.',
        placement: 'center'
      },
      {
        target: 'pairing-token',
        title: 'Your pairing token',
        body: 'This key tells the desktop app which workspace it belongs to. Copy it and paste it into ReFlow Desktop once.',
        hint: 'Treat it like a password. Anyone holding it can claim work from your workspace, so regenerating it disconnects every worker using the old one.',
        placement: 'bottom'
      },
      {
        target: 'worker-status',
        title: 'Connected workers',
        body: 'Every PC running ReFlow Desktop appears here. Green and executing means it is working right now; grey means it has stopped checking in.',
        hint: 'If this list is empty, the desktop app is not running or the token does not match.',
        placement: 'top'
      }
    ]
  },

  canvas: {
    id: 'canvas',
    name: 'Workflow canvas',
    steps: [
      {
        title: 'The workflow canvas',
        body: 'This is where a recorded task becomes something you can read and change. Every box on the canvas is one browser action, and the lines between them are the order.',
        hint: 'This is also where you repair a recording that did the wrong thing, without recording again.',
        placement: 'center'
      },
      {
        target: 'canvas-header',
        title: 'Name and save state',
        body: 'The title at the top is editable — rename it to something you will recognise in a list. A small amber dot appears while you have changes that are not saved yet.',
        placement: 'bottom'
      },
      {
        target: 'canvas-save',
        title: 'Save',
        body: 'Writes your edits back to the cloud. If you run without saving, you are testing the previous version of the workflow, not the one on screen.',
        placement: 'bottom'
      },
      {
        target: 'canvas-steps',
        title: 'The step list',
        body: 'Every step in order, numbered. Click one to open its settings on the right. In a long workflow this is much faster than hunting for the box on the canvas.',
        placement: 'right'
      },
      {
        target: 'canvas-add-step',
        title: 'Add a step',
        body: 'Click, type, select, navigate, wait, or extract. A new step is appended at the end — you then connect it into the flow on the canvas.',
        placement: 'right'
      },
      {
        target: 'canvas-stage',
        title: 'Steps and order',
        body: 'Each box is one action; the line from the bottom of a box to the top of the next is what makes it happen in that order. Drag a box to move it, drag from one dot to another to connect, and use the zoom controls at the top right.',
        hint: 'Selecting a box slides its settings in from the right — that is where selectors and values live.',
        placement: 'bottom'
      },
      {
        target: 'canvas-run',
        title: 'Run workflow',
        body: 'Saves and executes straight away, so you can watch your edit work. Afterwards, open the run in Run history to see what each step did.',
        placement: 'bottom'
      },
      {
        title: 'That is the canvas',
        body: 'Steps in order on the canvas, settings on the right, run from the header. Nothing here is permanent — you can always change a step and run again.',
        placement: 'center'
      }
    ]
  },

  artifacts: {
    id: 'artifacts',
    name: 'Files & results',
    steps: [
      {
        title: 'Everything your runs produced',
        body: 'Every file a workflow collected ends up here, whether it was a spreadsheet, a PDF or a captured table.',
        placement: 'center'
      },
      {
        target: 'artifacts-filters',
        title: 'Finding a specific file',
        body: 'Search by file name, workflow, site or checksum. Switch between a table and a folder view, and sort by age or size.',
        placement: 'bottom'
      },
      {
        target: 'artifacts-list',
        title: 'Downloading',
        body: 'The download button on each row pulls the file straight from cloud storage, so it works from any machine — not just the PC that produced it.',
        hint: 'The same files also sit in the folder you chose in ReFlow Desktop.',
        placement: 'top'
      }
    ]
  }
};

/** Maps a dashboard route to the tour that explains it. */
export function tourForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  // The editor is a full-bleed route, so it must be matched before the list page.
  if (pathname.startsWith('/dashboard/workflows/') && pathname.includes('/edit')) return 'canvas';
  if (pathname.startsWith('/dashboard/workflows')) return 'workflows';
  if (pathname.startsWith('/dashboard/runners')) return 'runners';
  if (pathname.startsWith('/dashboard/artifacts')) return 'artifacts';
  return null;
}

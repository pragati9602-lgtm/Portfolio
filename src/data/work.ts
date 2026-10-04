// Selected work shown on the landing page. TODO: replace with real projects.
// `final` is the finished piece (top layer); `process` is the sketch/rough shown underneath.
export interface WorkItem {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  year: string;
  final: string;
  process: string;
  alt: string;
}

export const selectedWork: WorkItem[] = [
  {
    slug: 'project-1',
    title: 'TODO: Project one',
    summary: 'One line on the story you found and how the brand tells it now.',
    tags: ['Branding', 'Packaging'],
    year: '2026',
    final: '/placeholders/project-1-final.svg',
    process: '/placeholders/project-1-process.svg',
    alt: 'TODO: describe the process sketch for project one',
  },
  {
    slug: 'project-2',
    title: 'TODO: Project two',
    summary: 'One line on the story you found and how the brand tells it now.',
    tags: ['Identity', 'Illustration'],
    year: '2025',
    final: '/placeholders/project-2-final.svg',
    process: '/placeholders/project-2-process.svg',
    alt: 'TODO: describe the process sketch for project two',
  },
  {
    slug: 'project-3',
    title: 'TODO: Project three',
    summary: 'One line on the story you found and how the brand tells it now.',
    tags: ['Editorial', 'Illustration'],
    year: '2025',
    final: '/placeholders/project-3-final.svg',
    process: '/placeholders/project-3-process.svg',
    alt: 'TODO: describe the process sketch for project three',
  },
];

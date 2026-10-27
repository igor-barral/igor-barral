// Fixed copy and display rules. Numbers come from the GitHub API (src/data.mjs).
// Edit here, then run `npm run build`.

export const site = 'https://igorbarral.com.br';

export const header = {
  label: 'Software engineer · web and mobile',
  motto: ['Fundamentals are portable.', 'Depth is a choice.'], // second part gets the yellow mark
};

// Linguist labels some PHP as Hack; fold aliases into the real language.
export const languageAliases = { Hack: 'PHP', SCSS: 'CSS' };
export const topLanguages = 8; // the rest folds into "Other"

// simple-icons export per language; missing ones get an initials badge.
export const languageIcons = {
  PHP: 'siPhp', JavaScript: 'siJavascript', TypeScript: 'siTypescript', Blade: 'siLaravel',
  Vue: 'siVuedotjs', Java: 'siOpenjdk', CSS: 'siCss3', HTML: 'siHtml5', 'C#': 'siDotnet',
  Kotlin: 'siKotlin', Dockerfile: 'siDocker', Shell: 'siGnubash', ABAP: 'siSap',
};

// Study repos are named <Topic>-<track>-study.
export const studyTracks = {
  softwarearchitecture: 'Software architecture', performance: 'Performance', erp: 'SAP ERP',
  devops: 'DevOps', language: 'Languages', framework: 'Frameworks', db: 'Databases', security: 'Security',
};

export const recentRepos = 5; // latest pushed public repos, study repos excluded

export const links = [
  { id: 'site', icon: 'logo', text: 'igorbarral.com.br', href: site },
  { id: 'linkedin', icon: 'linkedin', text: 'LinkedIn', href: 'https://www.linkedin.com/in/igorbarrall' },
  { id: 'youtube', icon: 'youtube', text: 'YouTube', href: 'https://youtube.com/@igorbarralltech' },
];

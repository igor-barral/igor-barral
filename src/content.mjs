// Fixed copy and display rules. Numbers come from the GitHub API (src/data.mjs).
// Edit here, then run `npm run build`.

export const site = 'https://igorbarral.com.br';

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

// Same set as the igorbarral.com.br footer and schema.org sameAs.
export const links = [
  { id: 'site', icon: 'logo', text: 'igorbarral.com.br', href: site },
  { id: 'linkedin', icon: 'linkedin', text: 'LinkedIn', href: 'https://www.linkedin.com/in/igorbarrall' },
  { id: 'youtube-tech', icon: 'youtube', text: 'YouTube · Tecnologia', href: 'https://youtube.com/@igorbarralltech' },
  { id: 'youtube-opina', icon: 'youtube', text: 'YouTube · Opinião', href: 'https://youtube.com/@igorbarrallopina' },
  { id: 'youtube-vlog', icon: 'youtube', text: 'YouTube · Vlog', href: 'https://youtube.com/@igorbarrallvlog' },
  { id: 'instagram', icon: 'instagram', text: 'Instagram', href: 'https://instagram.com/igorbarrall' },
  { id: 'tiktok', icon: 'tiktok', text: 'TikTok', href: 'https://tiktok.com/@igorbarralltech' },
  { id: 'facebook', icon: 'facebook', text: 'Facebook', href: 'https://facebook.com/igorbarrall' },
];

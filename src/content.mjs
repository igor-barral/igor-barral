// Everything the profile says. Edit here, then run `npm run build`.
// Copy mirrors igorbarral.com.br/en so both stay in sync.

export const site = 'https://igorbarral.com.br';
export const email = 'igormagno.dev@gmail.com';

export const hero = {
  label: 'Software engineer · web and mobile',
  title: ['Fundamentals are portable.', 'Depth is a choice.'], // second line gets the yellow mark
  text: '8 years building web and mobile systems in production. On YouTube (in Portuguese), I talk about software development, architecture, career and the market.',
};

export const build = {
  label: 'What I build',
  items: [
    { title: 'Web systems', text: 'Laravel and Symfony in production, APIs, integrations and high volume.' },
    { title: 'Mobile apps', text: 'React Native and Capacitor, from prototype to store.' },
    { title: 'Online stores', text: 'Payments, shipping and inventory integrated.' },
    { title: 'Applied AI', text: 'Agents, automations and RAG when the gain pays off.' },
  ],
};

export const projects = {
  label: 'Projects',
  items: [
    {
      id: 'verohire', logo: 'verohire.svg', title: 'Vero Hire', tag: 'live',
      href: 'https://verohire.igorbarral.com.br',
      text: 'Hiring without public job posts: the platform finds the right professionals and asks if they are interested.',
    },
    {
      id: 'iblinkguard', logo: 'iblinkguard.svg', title: 'IB Link Guard', tag: 'live',
      href: 'https://iblinkguard.igorbarral.com.br',
      text: 'Affiliate links with automatic destination monitoring.',
    },
    {
      id: 'sap-roadmap', logo: 'sap-study-road-map.svg', title: 'SAP Study Road Map', tag: 'in progress',
      href: 'https://github.com/igor-barral/SAP-Study-Road-Map',
      text: 'Public SAP ERP study roadmap for developers, with one repository per topic.',
      meta: 'SAP · ABAP · Fiori · GitHub',
    },
    {
      id: 'se-roadmap', logo: 'sap-study-road-map.svg', title: 'Software Engineering Study Road Map', tag: 'in progress',
      href: 'https://github.com/igor-barral/Software-Engineering-Study-Road-Map',
      text: 'Architecture, performance, databases and security, with one repository per topic.',
      meta: 'PHP · Laravel · Architecture · Performance',
    },
  ],
};

export const channels = {
  label: 'Social',
  title: 'Multiple channels, one way of thinking',
  intro: 'First the problem, then the platform, only then the language.',
  items: [
    {
      id: 'yt-tech', icon: 'youtube', title: 'Tecnologia', tag: 'main', meta: '@igorbarralltech',
      href: 'https://youtube.com/@igorbarralltech',
      text: 'Development, architecture, career and market, with code and real cases.',
    },
    {
      id: 'yt-opinion', icon: 'youtube', title: 'Opinião', meta: '@igorbarrallopina',
      href: 'https://youtube.com/@igorbarrallopina',
      text: 'Reactions and analysis of what is going around in tech, no fanboyism.',
    },
    {
      id: 'yt-vlog', icon: 'youtube', title: 'Vlog', meta: '@igorbarrallvlog',
      href: 'https://youtube.com/@igorbarrallvlog',
      text: 'Study and work routine, behind the scenes of every project.',
    },
  ],
  social: [
    { id: 'linkedin', icon: 'linkedin', text: 'LinkedIn', href: 'https://www.linkedin.com/in/igorbarrall' },
    { id: 'instagram', icon: 'instagram', text: 'Instagram', href: 'https://instagram.com/igorbarrall' },
    { id: 'tiktok', icon: 'tiktok', text: 'TikTok', href: 'https://tiktok.com/@igorbarralltech' },
    { id: 'facebook', icon: 'facebook', text: 'Facebook', href: 'https://facebook.com/igorbarrall' },
  ],
};

export const contact = {
  label: 'Contact',
  title: "Let's talk?",
  intro: 'Web and mobile projects, opportunities or content.',
  button: { text: 'igorbarral.com.br', href: site },
  link: { text: email, href: `mailto:${email}` },
};

export const footer = '© 2018 to 2026 Igor Barral · Minas Gerais, Brazil';

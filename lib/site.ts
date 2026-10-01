// Single source of truth for everything shown on the public marketing
// pages — company details, navigation, and the service/positioning copy
// from the company profile. Keeping it here means the header, footer,
// and every page stay in sync when a detail changes.

export const SITE = {
  name: "KnightLead Solutions",
  legalName: "KnightLead Cybersecurity Solutions",
  tagline: "Innovation. Lead. Secure.",
  shortDescription:
    "An infosec consultancy focused on three things: find the gaps, meet compliance, and train your people.",
  email: "hello@knightleadsolutions.com.ng",
  phone: "+234 803 200 0904",
  phoneHref: "+2348032000904",
  website: "https://knightleadsolutions.com.ng",
} as const;

export type NavLink = { href: string; label: string };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/bootcamps", label: "Bootcamps" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
];

export const VISION =
  "To be a trusted global leader in cybersecurity education and defense, enabling organizations to thrive securely in the digital age.";

export const MISSION =
  "We equip professionals and organizations with the skills, tools, and strategies to anticipate, prevent, and respond to cyber threats — ensuring resilience, compliance, and confidence in a connected world.";

export type Service = {
  slug: string;
  title: string;
  blurb: string;
  points: string[];
};

export const SERVICES: Service[] = [
  {
    slug: "cybersecurity-bootcamp-trainings",
    title: "Cybersecurity Bootcamp Trainings",
    blurb:
      "Intensive, hands-on programs engineered to bridge the critical talent shortage.",
    points: [
      "Real-world labs and skills, not just theory.",
      "Dedicated mentorship throughout the programme.",
      "Every graduate emerges with the technical capacity and confidence to protect enterprises in a connected world.",
    ],
  },
  {
    slug: "vulnerability-assessment",
    title: "Vulnerability Assessment",
    blurb:
      "We anticipate and prevent cyber threats before they ever disrupt your business.",
    points: [
      "Advanced scanning technologies deployed across your entire IT infrastructure.",
      "Rigorous analytical review alongside the tools.",
      "Recommendations tailored to each client's environment.",
    ],
  },
  {
    slug: "penetration-testing",
    title: "Penetration Testing",
    blurb:
      "We evaluate your security posture from an adversary's perspective.",
    points: [
      "Multi-layered testing that pairs automated tooling with manual craft.",
      "Covers the weaknesses automated testing approaches frequently miss.",
      "Findings translated into prioritised, actionable remediation steps.",
    ],
  },
  {
    slug: "soc-management",
    title: "Security Operations Center (SOC) Management",
    blurb:
      "With cyber threats evolving around the clock, passive or intermittent defense strategies are no longer sufficient.",
    points: [
      "End-to-end management, from initial architectural setup to ongoing monitoring.",
      "A centralised digital command center combining advanced security tooling with continuous human analysis.",
      "Proactive threat detection and rapid incident response isolate anomalies the moment they appear.",
      "Potential breaches are neutralised before they can disrupt operations.",
    ],
  },
  {
    slug: "cybersecurity-audits",
    title: "Cybersecurity Audits",
    blurb:
      "An independent assessment of how your controls and workflows interact to protect sensitive data.",
    points: [
      "Audit findings submitted to your leadership team.",
      "Aligned with international best practices and frameworks.",
      "Insulates your business from costly penalties.",
    ],
  },
  {
    slug: "cybersecurity-awareness-training",
    title: "Cybersecurity Awareness Training",
    blurb:
      "Your people are the largest attack surface — and the cheapest one to close.",
    points: [
      "Turns staff from a liability into your first line of defence.",
      "Covers phishing, social engineering, and safe everyday practice.",
      "Scales across the organisation and repeats as threats evolve.",
    ],
  },
];

export const PENETRATION_TESTING_AREAS = [
  "Web Application Security Testing",
  "Network Penetration Testing",
  "Cloud Penetration Testing",
  "IoT Security Testing",
  "Secure Code Review",
  "Threat Modeling",
];

export type Differentiator = { title: string; body: string };

export const WHY_CHOOSE_US: Differentiator[] = [
  {
    title: "Expert team",
    body: "A team of certified cybersecurity professionals with global experience in defense, compliance, and training.",
  },
  {
    title: "Tailored solutions",
    body: "Customised strategies aligned with each client's industry, size, and risk profile.",
  },
  {
    title: "Proactive defense",
    body: "The focus is on prevention and resilience, not just reaction.",
  },
  {
    title: "Global standards",
    body: "Our services align with international best practices and frameworks.",
  },
  {
    title: "Education first",
    body: "A commitment to building cybersecurity capacity through practical training and mentorship.",
  },
];

export const INDUSTRIES = [
  "Financial Services",
  "Healthcare",
  "Government & Public Sector",
  "Technology & Telecommunications",
  "Energy & Utilities",
  "Education & Training Institutions",
];

export type Leader = {
  name: string;
  role: string;
  /** Omitted where the profile lists credentials but no narrative bio. */
  bio?: string;
  credentials: string[];
};

// Biographies and credentials are taken verbatim from the company profile.
// The profile gives Oise a specialist bio and Olufemi a credentials list,
// so neither is padded with invented detail.
export const LEADERS: Leader[] = [
  {
    name: "Oise Akhibi",
    role: "Co-Founder",
    bio: "An accomplished cyber security and data privacy specialist with deep expertise in security audits, threat modeling, vulnerability assessments, and enterprise risk management. Highly proficient in navigating complex regulatory frameworks, with a strong track record in incident response and rapid remediation.",
    credentials: [
      "GDPR",
      "ISO 27001",
      "Nigeria Data Protection Act",
    ],
  },
  {
    name: "Olufemi Ibitoye",
    role: "Co-Founder",
    credentials: [
      "MSc in Information Technology, University of Aberdeen, UK",
      "ISC2 Certified in Cybersecurity",
      "Member of the British Computer Society (BCS)",
      "Oracle Database Certified Professional (OCP)",
    ],
  },
];
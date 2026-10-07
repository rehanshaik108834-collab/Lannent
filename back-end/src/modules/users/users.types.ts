import type { Role } from '../../common/constants/roles';
export type CompanyDetails = {
  name?: string;
  industry?: string;
  website?: string;
  size?: string;
  location?: string;
};
export type PortfolioProject = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  thumbnail?: string;
};
export type ExpertAvailability = {
  status?: string;
  maxCases?: string;
  type?: string;
};
export type UserBase = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  avatar: string;
  avatarColor: string;
  status: 'active' | 'suspended';
  joinDate: string;
  walletBalance: number;
  phone?: string;
  phoneCountryCode?: string;
  bio?: string;
};
export type ClientProfile = {
  userId: string;
  company?: string;
  location?: string;
  companyDetails?: CompanyDetails;
};
export type WorkerProfile = {
  userId: string;
  location?: string;
  skills?: string[];
  rating?: number;
  completedProjects?: number;
  jobTitle?: string;
  experienceLevel?: string;
  hourlyRate?: number;
  availability?: string;
  languages?: string[];
  portfolioProjects?: PortfolioProject[];
};
export type ExpertProfile = {
  userId: string;
  specialization?: string;
  reviewsDone?: number;
  domains?: string[];
  hourlyRate?: number;
  location?: string;
  availability?: ExpertAvailability;
  auditDomains?: string[];
};
/** Internal merged account; HTTP uses account/directory projections. */
export type UserRecord = UserBase & {
  company: string;
  location: string;
  skills: string[];
  rating: number;
  completedProjects: number;
  specialization: string;
  reviewsDone: number;
  domains: string[];
  hourlyRate?: number;
  companyDetails?: CompanyDetails;
  jobTitle?: string;
  experienceLevel?: string;
  availability?: string | ExpertAvailability;
  languages?: string[];
  portfolioProjects?: PortfolioProject[];
  auditDomains?: string[];
};

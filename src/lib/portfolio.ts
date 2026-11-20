import projectsData from "../../public/portfolio/portfolio.json";

export type PortfolioProject = {
  src: string;
  alt: string;
  caption: string;
  city: string;
  projectType: string;
  size: string;
  useCase: string;
  features: readonly string[];
  areaNote?: string;
};

export const portfolioProjects = projectsData as readonly PortfolioProject[];

export function getPortfolioProjectsForCity(city: string): readonly PortfolioProject[] {
  return portfolioProjects.filter((project) => project.city === city);
}

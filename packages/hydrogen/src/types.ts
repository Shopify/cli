export enum ComponentType {
  Client = 'React client component',
  Shared = 'React shared component',
  Server = 'React server component',
}

export interface CheckResult {
  /** unique id of the check **/
  id: string;
  /** category type for grouping common checks **/
  type: 'Setup' | 'Dependencies' | 'Deployment' | 'Performance';
  /** short description of the check **/
  description: string;
  /** indicates whether the current project meets the requirements of the check **/
  success: boolean;
  /** link to learn more about the check **/
  link?: string;
  /** optional function to correct the problems in the current project **/
  fix?: (context: any) => void;
}

export type Loggable = string | (() => string);

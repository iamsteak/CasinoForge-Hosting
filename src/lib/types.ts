export type Deployment = {
  id: string;
  status: string;
  createdAt: string;
  url: string | null;
  canRollback: boolean;
  canRedeploy: boolean;
};

export type RuntimeLog = {
  timestamp: string;
  message: string;
  severity: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  outcome: string;
  summary: string;
  deployment_id: string | null;
  created_at: string;
};

export type OverviewData = {
  connected: boolean;
  activityReady: boolean;
  missing: string[];
  project: string | null;
  deployments: Deployment[];
  variableNames: string[];
  activity: ActivityItem[];
};

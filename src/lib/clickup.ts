const BASE_URL = "https://api.clickup.com/api/v2";
const WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID || "90151520868";
const KUNDER_SPACE_ID = "90156320469";

function getAuthHeader(): string {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN is not set");
  return token;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  task_count: string;
  statuses: { status: string; type: string }[];
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: string | number | { id: string; name: string } | null;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; type: string };
  custom_fields: ClickUpCustomField[];
  date_created: string;
}

export interface CustomerFolderData {
  folderId: string;
  name: string;
  cvr: string | null;
  startDate: string | null;
  partner: string | null;
  status: string | null;
  taskCount: number;
}

async function clickupFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function listCustomerFolders(): Promise<ClickUpFolder[]> {
  const response = await clickupFetch<{ folders: ClickUpFolder[] }>(
    `/space/${KUNDER_SPACE_ID}/folder?archived=false`
  );
  return response.folders;
}

export async function getFolderTasks(folderId: string): Promise<ClickUpTask[]> {
  // Get tasks from the first list in the folder (onboarding form)
  const listsResponse = await clickupFetch<{ lists: { id: string }[] }>(
    `/folder/${folderId}/list?archived=false`
  );

  if (!listsResponse.lists.length) return [];

  const allTasks: ClickUpTask[] = [];
  for (const list of listsResponse.lists) {
    const tasksResponse = await clickupFetch<{ tasks: ClickUpTask[] }>(
      `/list/${list.id}/task?archived=false&include_closed=true&subtasks=true`
    );
    allTasks.push(...tasksResponse.tasks);
  }

  return allTasks;
}

/**
 * Extract customer data from a folder's tasks (custom fields).
 * Looks for the onboarding form task which has CVR, start date, partner fields.
 */
export async function getCustomerDataFromFolder(
  folder: ClickUpFolder
): Promise<CustomerFolderData> {
  const result: CustomerFolderData = {
    folderId: folder.id,
    name: folder.name,
    cvr: null,
    startDate: null,
    partner: null,
    status: null,
    taskCount: parseInt(folder.task_count) || 0,
  };

  try {
    const tasks = await getFolderTasks(folder.id);

    // Look for custom fields across all tasks
    for (const task of tasks) {
      for (const field of task.custom_fields) {
        if (field.name === "CVR-nummer" && field.value) {
          result.cvr = String(field.value);
        }
        if (field.name === "Kunde start dato" && field.value) {
          result.startDate = String(field.value);
        }
        if (field.name === "Partner" && field.value) {
          const val = field.value;
          if (typeof val === "object" && val !== null && "name" in val) {
            result.partner = (val as { name: string }).name;
          } else {
            result.partner = String(val);
          }
        }
      }

      // Use the task status as the customer status if it's an onboarding task
      if (task.name.toLowerCase().includes("formular") || task.name.toLowerCase().includes("onboarding")) {
        result.status = task.status.status;
      }
    }
  } catch (error) {
    console.error(`Failed to get data for folder ${folder.name}:`, error);
  }

  return result;
}

export async function getAllCustomerData(): Promise<CustomerFolderData[]> {
  const folders = await listCustomerFolders();

  // Process in batches of 10 to avoid rate limiting
  const results: CustomerFolderData[] = [];
  for (let i = 0; i < folders.length; i += 10) {
    const batch = folders.slice(i, i + 10);
    const batchResults = await Promise.all(
      batch.map(folder => getCustomerDataFromFolder(folder))
    );
    results.push(...batchResults);
  }

  return results;
}

export async function getTeamMemberCount(): Promise<number> {
  const response = await clickupFetch<{ teams: { members: { user: { id: number } }[] }[] }>(
    `/team`
  );
  return response.teams?.[0]?.members?.length ?? 0;
}

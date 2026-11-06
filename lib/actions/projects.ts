"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  listAllTasks,
} from "@/lib/services/projects.service";
import type { TaskWithProject } from "@/lib/services/projects.service";
import type { TablesUpdate } from "@/types/database";

function rev(businessId: string) {
  revalidatePath(`/businesses/${businessId}/projects`);
}

export async function createProjectAction(
  businessId: string,
  input: { name: string; description?: string; due_date?: string | null },
): Promise<{ error?: string }> {
  await requireUser();
  const name = input.name?.trim().slice(0, 160);
  if (!name) return { error: "נא למלא שם פרויקט" };
  try {
    await createProject(businessId, {
      name,
      description: input.description?.trim().slice(0, 600) || null,
      due_date: input.due_date || null,
    });
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function setProjectStatusAction(
  businessId: string,
  projectId: string,
  status: "active" | "done" | "archived",
): Promise<{ error?: string }> {
  await requireUser();
  if (!["active", "done", "archived"].includes(status)) return { error: "סטטוס לא תקין" };
  try {
    await updateProject(projectId, { status });
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function deleteProjectAction(
  businessId: string,
  projectId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteProject(projectId);
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function addTaskAction(
  businessId: string,
  projectId: string | null,
  input: {
    title: string;
    assignee?: string;
    due_date?: string | null;
    staffId?: string | null;
    priority?: "low" | "normal" | "high" | null;
  },
): Promise<{ error?: string }> {
  await requireUser();
  const title = input.title?.trim().slice(0, 200);
  if (!title) return { error: "נא למלא משימה" };
  try {
    await createTask(businessId, {
      project_id: projectId,
      title,
      assignee: input.assignee?.trim().slice(0, 80) || null,
      due_date: input.due_date || null,
      staff_id: input.staffId || null,
      priority: input.priority || null,
    });
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** All tasks (project-linked + standalone) for the "משימות" tab. */
export async function listTasksAction(
  businessId: string,
): Promise<{ tasks?: TaskWithProject[]; error?: string }> {
  await requireUser();
  try {
    const tasks = await listAllTasks(businessId);
    return { tasks };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת המשימות נכשלה" };
  }
}

/** Edits a task's title/due date/staff assignee/status/priority (any subset). */
export async function editTaskAction(
  businessId: string,
  taskId: string,
  input: {
    title?: string;
    due_date?: string | null;
    staffId?: string | null;
    status?: "open" | "in_progress" | "done";
    priority?: "low" | "normal" | "high" | null;
  },
): Promise<{ error?: string }> {
  await requireUser();
  const fields: TablesUpdate<"project_tasks"> = {};
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 200);
    if (!title) return { error: "נא למלא כותרת" };
    fields.title = title;
  }
  if (input.due_date !== undefined) fields.due_date = input.due_date || null;
  if (input.staffId !== undefined) fields.staff_id = input.staffId || null;
  if (input.status !== undefined) fields.status = input.status;
  if (input.priority !== undefined) fields.priority = input.priority || null;
  try {
    await updateTask(taskId, fields);
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function toggleTaskAction(
  businessId: string,
  taskId: string,
  done: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await updateTask(taskId, { done });
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function deleteTaskAction(
  businessId: string,
  taskId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteTask(taskId);
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

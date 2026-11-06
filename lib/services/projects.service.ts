import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectTask, TablesInsert, TablesUpdate } from "@/types/database";

export type ProjectWithTasks = Project & { tasks: ProjectTask[] };

/** A task plus the name of the project it belongs to (null for standalone tasks). */
export type TaskWithProject = ProjectTask & { projectName: string | null };

/** All projects for a business, each with its tasks (newest projects first). */
export async function listProjects(businessId: string): Promise<ProjectWithTasks[]> {
  const supabase = await createClient();
  const [{ data: projects, error: pErr }, { data: tasks, error: tErr }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_tasks")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (tErr) throw new Error(tErr.message);

  const byProject = new Map<string, ProjectTask[]>();
  for (const t of tasks ?? []) {
    if (!t.project_id) continue; // standalone task — not attached to a project
    const arr = byProject.get(t.project_id) ?? [];
    arr.push(t);
    byProject.set(t.project_id, arr);
  }
  return (projects ?? []).map((p) => ({ ...p, tasks: byProject.get(p.id) ?? [] }));
}

/**
 * Every task for a business — project-linked and standalone — with the
 * owning project's name attached (null for standalone). Used by the tasks
 * tab, which shows both kinds grouped by due date rather than by project.
 */
export async function listAllTasks(businessId: string): Promise<TaskWithProject[]> {
  const supabase = await createClient();
  const [{ data: tasks, error: tErr }, { data: projects, error: pErr }] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name").eq("business_id", businessId),
  ]);
  if (tErr) throw new Error(tErr.message);
  if (pErr) throw new Error(pErr.message);

  const nameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  return (tasks ?? []).map((t) => ({
    ...t,
    projectName: t.project_id ? (nameById.get(t.project_id) ?? null) : null,
  }));
}

export async function createProject(
  businessId: string,
  input: Omit<TablesInsert<"projects">, "business_id">,
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, business_id: businessId })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create project");
  return data;
}

export async function updateProject(id: string, fields: TablesUpdate<"projects">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createTask(
  businessId: string,
  input: Omit<TablesInsert<"project_tasks">, "business_id">,
): Promise<ProjectTask> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_tasks")
    .insert({ ...input, business_id: businessId })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create task");
  return data;
}

/**
 * Updates a task. `status` and the legacy `done` boolean are kept in sync
 * automatically, whichever the caller sets — old checklist toggles (`done`)
 * keep working, and new status transitions (`status`) also flip `done`.
 */
export async function updateTask(id: string, fields: TablesUpdate<"project_tasks">): Promise<void> {
  const supabase = await createClient();
  const patch: TablesUpdate<"project_tasks"> = { ...fields };
  if (patch.status !== undefined) {
    patch.done = patch.status === "done";
  } else if (patch.done !== undefined) {
    patch.status = patch.done ? "done" : "open";
  }
  const { error } = await supabase.from("project_tasks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

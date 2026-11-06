"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  CircleCheck,
  Circle,
  CircleDot,
  User,
  CalendarClock,
  ChevronDown,
  FolderKanban,
  ListTodo,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createProjectAction,
  setProjectStatusAction,
  deleteProjectAction,
  addTaskAction,
  toggleTaskAction,
  deleteTaskAction,
  listTasksAction,
  editTaskAction,
} from "@/lib/actions/projects";
import { listBookingStaffAction } from "@/lib/actions/booking-staff";
import type { ProjectWithTasks, TaskWithProject } from "@/lib/services/projects.service";
import type { BookingStaff } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  done: "הושלם",
  archived: "בארכיון",
};
const STATUS_BADGE: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-green-100 text-green-800 border-green-200",
  archived: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const TASK_STATUS_ORDER = ["open", "in_progress", "done"] as const;
type TaskStatus = (typeof TASK_STATUS_ORDER)[number];
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "פתוחה",
  in_progress: "בתהליך",
  done: "הושלמה",
};
const PRIORITY_LABEL: Record<string, string> = { low: "נמוכה", normal: "רגילה", high: "גבוהה" };
const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600 border-zinc-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  high: "bg-red-100 text-red-800 border-red-200",
};
const NEUTRAL_STAFF_COLOR = "#a1a1aa";

function nextTaskStatus(status: string): TaskStatus {
  const i = TASK_STATUS_ORDER.indexOf(status as TaskStatus);
  return TASK_STATUS_ORDER[(i + 1) % TASK_STATUS_ORDER.length] ?? "open";
}

function TaskStatusIcon({ status, className }: { status: string; className?: string }) {
  if (status === "done") return <CircleCheck className={className ?? "size-4 text-green-600"} />;
  if (status === "in_progress") return <CircleDot className={className ?? "size-4 text-amber-500"} />;
  return <Circle className={className ?? "size-4 text-muted-foreground"} />;
}

function dateLabel(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) : null;
}

function isOverdue(d: string | null, todayMs: number): boolean {
  if (!d) return false;
  return new Date(d).getTime() < todayMs;
}

export function ProjectsManager({
  businessId,
  projects,
}: {
  businessId: string;
  projects: ProjectWithTasks[];
}) {
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addProject() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createProjectAction(businessId, { name, due_date: due || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הפרויקט נוסף ✓");
        setName("");
        setDue("");
      }
    });
  }

  return (
    <Tabs defaultValue="projects" dir="rtl">
      <TabsList>
        <TabsTrigger value="projects" className="gap-1.5">
          <FolderKanban className="size-3.5" />
          פרויקטים
        </TabsTrigger>
        <TabsTrigger value="tasks" className="gap-1.5">
          <ListTodo className="size-3.5" />
          משימות
        </TabsTrigger>
      </TabsList>

      <TabsContent value="projects" className="mt-4">
        <div className="flex flex-col gap-5">
          {/* New project */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <Input
                placeholder="שם פרויקט חדש"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-[180px] flex-1"
              />
              <Input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-40"
                title="תאריך יעד"
              />
              <Button onClick={addProject} disabled={isPending || !name.trim()} className="gap-1.5">
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                פרויקט חדש
              </Button>
            </CardContent>
          </Card>

          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                עדיין אין פרויקטים — צרו את הראשון למעלה
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  businessId={businessId}
                  project={p}
                  busyId={busyId}
                  setBusyId={setBusyId}
                />
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        <TasksTab businessId={businessId} />
      </TabsContent>
    </Tabs>
  );
}

function ProjectCard({
  businessId,
  project,
  busyId,
  setBusyId,
}: {
  businessId: string;
  project: ProjectWithTasks;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(project.status === "active");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [todayMs] = useState(() => new Date().setHours(0, 0, 0, 0));
  const [isPending, startTransition] = useTransition();

  const doneCount = project.tasks.filter((t) => t.done).length;
  const total = project.tasks.length;

  function run(fn: () => Promise<{ error?: string }>, id: string, okMsg?: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else if (okMsg) toast.success(okMsg);
      setBusyId(null);
    });
  }

  function addTask() {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await addTaskAction(businessId, project.id, {
        title,
        assignee: assignee || undefined,
        due_date: due || null,
      });
      if (res.error) toast.error(res.error);
      else {
        setTitle("");
        setAssignee("");
        setDue("");
      }
    });
  }

  return (
    <Card className={project.status === "archived" ? "opacity-60" : ""}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
            <span className="truncate font-medium">{project.name}</span>
            <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[project.status] ?? ""}`}>
              {STATUS_LABEL[project.status] ?? project.status}
            </Badge>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">
                {doneCount}/{total}
              </span>
            )}
            {project.due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(project.due_date, todayMs) && project.status === "active" ? "text-destructive" : "text-muted-foreground"}`}>
                <CalendarClock className="size-3" />
                {dateLabel(project.due_date)}
              </span>
            )}
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {project.status !== "done" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-green-600"
                onClick={() => run(() => setProjectStatusAction(businessId, project.id, "done"), project.id, "הפרויקט הושלם ✓")}
                disabled={busyId === project.id}
              >
                <Check className="size-3.5" /> סיום
              </Button>
            )}
            {project.status === "active" ? (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => run(() => setProjectStatusAction(businessId, project.id, "archived"), project.id)}
                disabled={busyId === project.id}>
                ארכיון
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => run(() => setProjectStatusAction(businessId, project.id, "active"), project.id)}
                disabled={busyId === project.id}>
                הפעל
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => run(() => deleteProjectAction(businessId, project.id), project.id)}
              disabled={busyId === project.id}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {project.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => run(() => toggleTaskAction(businessId, t.id, !t.done), t.id)}
                  disabled={busyId === t.id}
                  className="shrink-0"
                >
                  {t.done ? (
                    <CircleCheck className="size-4 text-green-600" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                </button>
                <span className={`min-w-0 flex-1 ${t.done ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </span>
                {t.assignee && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="size-3" />
                    {t.assignee}
                  </span>
                )}
                {t.due_date && (
                  <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(t.due_date, todayMs) && !t.done ? "text-destructive" : "text-muted-foreground"}`}>
                    <CalendarClock className="size-3" />
                    {dateLabel(t.due_date)}
                  </span>
                )}
                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive"
                  onClick={() => run(() => deleteTaskAction(businessId, t.id), t.id)}
                  disabled={busyId === t.id}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}

            {/* Add task */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Input
                placeholder="משימה חדשה"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 min-w-[140px] flex-1 text-sm"
              />
              <Input
                placeholder="אחראי"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="h-8 w-24 text-sm"
              />
              <Input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="h-8 w-36 text-sm"
                title="תאריך יעד"
              />
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addTask} disabled={isPending || !title.trim()}>
                <Plus className="size-3.5" /> הוספה
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Global tasks view: standalone quick-add + every task (project or standalone), grouped by due date. */
function TasksTab({ businessId }: { businessId: string }) {
  const [tasks, setTasks] = useState<TaskWithProject[] | null>(null);
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [, startTransition] = useTransition();

  // Quick-add form state
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [staffId, setStaffId] = useState("none");
  const [priority, setPriority] = useState("none");
  const [adding, setAdding] = useState(false);

  const [todayStr] = useState(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
  const [todayMs] = useState(() => new Date().setHours(0, 0, 0, 0));

  function reload() {
    listTasksAction(businessId).then((res) => {
      if (res.error) toast.error(res.error);
      else setTasks(res.tasks ?? []);
    });
  }

  // Client-fetch-then-set on mount — mirrors the established booking pattern
  // (async call kicked off from the effect, state lands in its own .then()).
  useEffect(() => {
    let active = true;
     
    listTasksAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) toast.error(res.error);
      else setTasks(res.tasks ?? []);
    });
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (!res.error) setStaff(res.staff ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  function addQuickTask() {
    if (!title.trim()) return;
    setAdding(true);
    startTransition(async () => {
      const res = await addTaskAction(businessId, null, {
        title,
        due_date: due || null,
        staffId: staffId === "none" ? null : staffId,
        priority: priority === "none" ? null : (priority as "low" | "normal" | "high"),
      });
      setAdding(false);
      if (res.error) toast.error(res.error);
      else {
        toast.success("המשימה נוספה ✓");
        setTitle("");
        setDue("");
        setStaffId("none");
        setPriority("none");
        reload();
      }
    });
  }

  function cycleStatus(t: TaskWithProject) {
    const next = nextTaskStatus(t.status);
    setBusyId(t.id);
    setTasks((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, status: next, done: next === "done" } : x)));
    startTransition(async () => {
      const res = await editTaskAction(businessId, t.id, { status: next });
      if (res.error) {
        toast.error(res.error);
        reload();
      }
      setBusyId(null);
    });
  }

  function removeTask(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteTaskAction(businessId, id);
      if (res.error) toast.error(res.error);
      else setTasks((prev) => (prev ?? []).filter((t) => t.id !== id));
      setBusyId(null);
    });
  }

  function setTaskStaff(t: TaskWithProject, nextStaffId: string) {
    startTransition(async () => {
      const res = await editTaskAction(businessId, t.id, { staffId: nextStaffId === "none" ? null : nextStaffId });
      if (res.error) toast.error(res.error);
      else reload();
    });
  }

  if (tasks === null) {
    return (
      <p className="flex items-center gap-1.5 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> טוען משימות…
      </p>
    );
  }

  const open = tasks.filter((t) => t.status !== "done");
  const doneList = tasks.filter((t) => t.status === "done");
  const overdue = open.filter((t) => t.due_date && isOverdue(t.due_date, todayMs));
  const today = open.filter((t) => t.due_date === todayStr);
  const upcoming = open.filter((t) => !overdue.includes(t) && !today.includes(t));

  const groups: { key: string; label: string; icon: React.ReactNode; items: TaskWithProject[] }[] = [
    { key: "overdue", label: "באיחור", icon: <CalendarClock className="size-3.5 text-destructive" />, items: overdue },
    { key: "today", label: "היום", icon: <CalendarClock className="size-3.5 text-primary" />, items: today },
    { key: "upcoming", label: "קרוב", icon: <CalendarClock className="size-3.5 text-muted-foreground" />, items: upcoming },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2.5 p-4">
          <Input
            placeholder="משימה חדשה (ללא פרויקט)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[160px] flex-1"
          />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-40" title="תאריך יעד" />
          {staff.length > 0 && (
            <Select value={staffId} onValueChange={(v) => setStaffId(v ?? "none")}>
              <SelectTrigger className="w-36"><SelectValue placeholder="אחראי" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {staff.filter((s) => s.active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={priority} onValueChange={(v) => setPriority(v ?? "none")}>
            <SelectTrigger className="w-32"><SelectValue placeholder="עדיפות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא עדיפות</SelectItem>
              <SelectItem value="low">נמוכה</SelectItem>
              <SelectItem value="normal">רגילה</SelectItem>
              <SelectItem value="high">גבוהה</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addQuickTask} disabled={adding || !title.trim()} className="gap-1.5">
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוספה
          </Button>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            עדיין אין משימות — הוסיפו אחת למעלה, או הוסיפו משימות מתוך פרויקט
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  {g.icon}
                  {g.label}
                  <span className="font-normal">({g.items.length})</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.items.map((t) => {
                    const taskStaff = t.staff_id ? staffById.get(t.staff_id) : null;
                    return (
                      <Card key={t.id}>
                        <CardContent className="flex flex-wrap items-center gap-2.5 p-3">
                          <button onClick={() => cycleStatus(t)} disabled={busyId === t.id} className="shrink-0" title={TASK_STATUS_LABEL[t.status as TaskStatus] ?? t.status}>
                            <TaskStatusIcon status={t.status} />
                          </button>
                          <span className={`min-w-0 flex-1 text-sm ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                            {t.title}
                          </span>
                          {t.projectName && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <FolderKanban className="size-2.5" />
                              {t.projectName}
                            </Badge>
                          )}
                          {t.priority && (
                            <Badge variant="outline" className={`gap-1 text-[10px] ${PRIORITY_BADGE[t.priority] ?? ""}`}>
                              <Flag className="size-2.5" />
                              {PRIORITY_LABEL[t.priority] ?? t.priority}
                            </Badge>
                          )}
                          {staff.length > 0 && (
                            <Select value={t.staff_id ?? "none"} onValueChange={(v) => setTaskStaff(t, v ?? "none")}>
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <span className="flex items-center gap-1.5 truncate">
                                  {taskStaff && <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: taskStaff.color || NEUTRAL_STAFF_COLOR }} />}
                                  <SelectValue placeholder="ללא שיוך" />
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">ללא שיוך</SelectItem>
                                {staff.filter((s) => s.active).map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {t.due_date && (
                            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue(t.due_date, todayMs) ? "text-destructive" : "text-muted-foreground"}`}>
                              <CalendarClock className="size-3" />
                              {dateLabel(t.due_date)}
                            </span>
                          )}
                          <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTask(t.id)} disabled={busyId === t.id}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ),
          )}

          {doneList.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
              >
                <ChevronDown className={`size-3.5 transition-transform ${showDone ? "" : "-rotate-90"}`} />
                הושלמו ({doneList.length})
              </button>
              {showDone && (
                <div className="flex flex-col gap-1.5">
                  {doneList.map((t) => (
                    <Card key={t.id} className="opacity-60">
                      <CardContent className="flex items-center gap-2.5 p-3">
                        <button onClick={() => cycleStatus(t)} disabled={busyId === t.id} className="shrink-0">
                          <TaskStatusIcon status={t.status} />
                        </button>
                        <span className="min-w-0 flex-1 text-sm text-muted-foreground line-through">{t.title}</span>
                        {t.projectName && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <FolderKanban className="size-2.5" />
                            {t.projectName}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTask(t.id)} disabled={busyId === t.id}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

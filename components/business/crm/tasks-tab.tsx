"use client";

import { useMemo, useTransition, useState } from "react";
import { Plus, Trash2, Loader2, Circle, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";

import { createTaskAction, toggleTaskAction, deleteTaskAction } from "@/lib/actions/crm";
import type { CrmTask, CrmLead, CrmCustomer } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/business/crm-dashboard";

const PRIORITY_LABEL = { low: "נמוכה", medium: "בינונית", high: "גבוהה" } as const;
const PRIORITY_COLOR = { low: "outline", medium: "secondary", high: "default" } as const;

export function TasksTab({ businessId, tasks, leads, customers, onRefresh }: {
  businessId: string;
  tasks: CrmTask[];
  leads: CrmLead[];
  customers: CrmCustomer[];
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [isPending, start] = useTransition();

  const leadNameById = useMemo(() => new Map(leads.map((l) => [l.id, l.name])), [leads]);
  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  function add() {
    if (!title.trim()) return;
    start(async () => {
      const res = await createTaskAction(businessId, { title, priority, due_date: dueDate || undefined });
      if (res.error) toast.error(res.error);
      else { setTitle(""); setDueDate(""); onRefresh(); }
    });
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  function linkedName(task: CrmTask): string | null {
    if (task.lead_id) return leadNameById.get(task.lead_id) ? `ליד: ${leadNameById.get(task.lead_id)}` : null;
    if (task.customer_id) return customerNameById.get(task.customer_id) ? `לקוח: ${customerNameById.get(task.customer_id)}` : null;
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input placeholder="משימה חדשה *" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">עדיפות נמוכה</SelectItem>
              <SelectItem value="medium">עדיפות בינונית</SelectItem>
              <SelectItem value="high">עדיפות גבוהה</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm" />
            <Button onClick={add} disabled={isPending || !title.trim()} size="icon">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <EmptyState text="עדיין אין משימות" />
        ) : (
          <div className="space-y-1">
            {open.map((t) => <TaskRow key={t.id} task={t} businessId={businessId} linkedName={linkedName(t)} onRefresh={onRefresh} />)}
            {done.length > 0 && (
              <>
                <div className="pt-2 text-xs font-medium text-muted-foreground">הושלמו</div>
                {done.map((t) => <TaskRow key={t.id} task={t} businessId={businessId} linkedName={linkedName(t)} onRefresh={onRefresh} />)}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, businessId, linkedName, onRefresh }: {
  task: CrmTask;
  businessId: string;
  linkedName: string | null;
  onRefresh: () => void;
}) {
  const [isPending, start] = useTransition();
  function toggle() {
    start(async () => { await toggleTaskAction(businessId, task.id, !task.done); onRefresh(); });
  }
  function remove() {
    start(async () => { await deleteTaskAction(businessId, task.id); onRefresh(); });
  }
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${task.done ? "opacity-50" : ""}`}>
      <button onClick={toggle} disabled={isPending} className="text-muted-foreground hover:text-primary">
        {task.done ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <span className={`text-sm font-medium ${task.done ? "line-through" : ""}`}>{task.title}</span>
        {task.due_date && (
          <span className="ms-2 text-xs text-muted-foreground">
            {new Date(task.due_date).toLocaleDateString("he-IL")}
          </span>
        )}
      </div>
      {linkedName && (
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Link2 className="size-3" />
          {linkedName}
        </Badge>
      )}
      <Badge variant={PRIORITY_COLOR[task.priority] as "default" | "secondary" | "outline"} className="text-xs">
        {PRIORITY_LABEL[task.priority]}
      </Badge>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={remove} disabled={isPending}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

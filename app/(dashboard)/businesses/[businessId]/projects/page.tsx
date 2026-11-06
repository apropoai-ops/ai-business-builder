import { notFound } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listProjects } from "@/lib/services/projects.service";
import { ProjectsManager } from "@/components/business/projects-manager";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "ניהול פרויקטים" };

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "projects");

  const projects = await listProjects(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderKanban className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">ניהול פרויקטים</h1>
          <p className="text-sm text-muted-foreground">
            פרויקטים, משימות, אחראים ותאריכי יעד — הכל במקום אחד
          </p>
        </div>
      </div>

      <ProjectsManager businessId={businessId} projects={projects} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Check, ChevronDown, LayoutGrid, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SwitcherBusiness = {
  id: string;
  name: string | null;
  status: string;
};

export function BusinessSwitcher({
  businesses,
  currentId,
  currentName,
}: {
  businesses: SwitcherBusiness[];
  currentId: string;
  currentName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="-ms-2 h-auto gap-2 px-2 py-1 text-2xl font-bold"
          />
        }
      >
        <span className="truncate">{currentName}</span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* Base UI requires GroupLabel to live inside a Group — a bare label throws (error #31). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>העסקים שלי</DropdownMenuLabel>
        </DropdownMenuGroup>
        {businesses.map((business) => (
          <DropdownMenuItem
            key={business.id}
            render={<Link href={`/businesses/${business.id}/overview`} />}
          >
            <Check
              className={cn(
                "size-4",
                business.id === currentId ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="truncate">{business.name ?? "עסק ללא שם"}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/businesses" />}>
          <LayoutGrid className="size-4" />
          כל העסקים
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/businesses/new" />}>
          <Plus className="size-4" />
          עסק חדש
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

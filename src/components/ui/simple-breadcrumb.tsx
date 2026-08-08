// src/components/ui/simple-breadcrumb.tsx
import { Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
import React from "react";

export type Crumb = { label: string; to?: string; slug?: string };

export function SimpleBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[12px]">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.label}>
              {i > 0 && <BreadcrumbSeparator className="text-muted-foreground/60" />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to as "/"} className="hover:text-accent">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : crumb.slug ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to="/collections/$slug"
                      params={{ slug: crumb.slug }}
                      className="hover:text-accent"
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

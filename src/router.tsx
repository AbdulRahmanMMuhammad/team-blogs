import { createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/client/components/BlogShell";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  });
}

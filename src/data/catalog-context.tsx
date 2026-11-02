import { createContext, useContext, type ReactNode } from "react";
import type { CustomCategory, TxType } from "../types";
import { categoriesFor, getCategory, type Category } from "./catalog";

const CatalogContext = createContext<CustomCategory[]>([]);

export function CatalogProvider({ categories, children }: { categories: CustomCategory[]; children: ReactNode }) {
  return <CatalogContext.Provider value={categories}>{children}</CatalogContext.Provider>;
}

export function useCustomCategories(): CustomCategory[] {
  return useContext(CatalogContext);
}

export function useCategoryList(kind: TxType): Category[] {
  return categoriesFor(kind, useContext(CatalogContext));
}

export function useCategoryLookup(): (id: string) => Category | undefined {
  const custom = useContext(CatalogContext);
  return (id: string) => getCategory(id, custom);
}

"use client";
import React, { createContext, useContext } from "react";

type BreadcrumbContextType = {
  itemName?: string;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({});

export const useBreadcrumb = () => useContext(BreadcrumbContext);

export const BreadcrumbProvider: React.FC<
  React.PropsWithChildren<BreadcrumbContextType>
> = ({ children, itemName }) => (
  <BreadcrumbContext.Provider value={{ itemName }}>
    {children}
  </BreadcrumbContext.Provider>
); 
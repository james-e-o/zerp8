'use client';

import { createContext } from 'react';

export const ParamsContext = createContext();

export function ParamsProvider({ params, children }) {
  return (
    <ParamsContext.Provider value={params}>
      {children}
    </ParamsContext.Provider>
  );
}

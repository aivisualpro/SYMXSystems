"use client";

import { createContext, useContext } from "react";

export interface AddRefCtx {
    addRef: React.MutableRefObject<(() => void) | null>;
}

export const AddRefContext = createContext<AddRefCtx>({ addRef: { current: null } });
export const useAddRef = () => useContext(AddRefContext);

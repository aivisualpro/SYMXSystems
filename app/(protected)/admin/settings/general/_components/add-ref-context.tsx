"use client";

import { createContext, useContext } from "react";

export interface AddRefCtx {
    addRef: React.MutableRefObject<(() => void) | null>;
    quickEditRef: React.MutableRefObject<(() => void) | null>;
}

export const AddRefContext = createContext<AddRefCtx>({
    addRef: { current: null },
    quickEditRef: { current: null },
});
export const useAddRef = () => useContext(AddRefContext);

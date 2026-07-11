import { useEffect, useRef } from "react";

function serializeDraft(draft) {
    return JSON.stringify({
        title: draft.title,
        description: draft.description,
        text: draft.text,
        imageUrl: draft.imageUrl,
        tagsInput: draft.tagsInput,
        accessType: draft.accessType,
        price: draft.price
    });
}

export function usePostDraft(storageKey, draft, setDraft) {
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (!storageKey || hasLoadedRef.current) {
            return;
        }

        hasLoadedRef.current = true;

        try {
            const savedValue = localStorage.getItem(storageKey);

            if (!savedValue) {
                return;
            }

            const parsed = JSON.parse(savedValue);
            setDraft((current) => ({
                ...current,
                ...parsed
            }));
        } catch {
            localStorage.removeItem(storageKey);
        }
    }, [storageKey, setDraft]);

    useEffect(() => {
        if (!storageKey || !hasLoadedRef.current) {
            return;
        }

        localStorage.setItem(storageKey, serializeDraft(draft));
    }, [storageKey, draft]);

    function clearDraft() {
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    }

    return {
        clearDraft
    };
}

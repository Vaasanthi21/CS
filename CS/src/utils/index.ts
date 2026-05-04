export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

export const REFINE_SESSION_STORAGE_KEY = 'creative_studio_refine_session';

export function persistRefineSession(state: unknown) {
    if (typeof window === 'undefined' || !state) {
        return;
    }

    try {
        window.sessionStorage.setItem(REFINE_SESSION_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('Failed to persist refine session:', error);
    }
}

export function restoreRefineSession<T>() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = window.sessionStorage.getItem(REFINE_SESSION_STORAGE_KEY);
        return stored ? (JSON.parse(stored) as T) : null;
    } catch (error) {
        console.warn('Failed to restore refine session:', error);
        return null;
    }
}
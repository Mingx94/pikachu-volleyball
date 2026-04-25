export const localStorageWrapper = {
  get: (key: string): string | null => {
    let value: string | null = null;
    try {
      value = localStorage.getItem(key);
    } catch (err) {
      console.error(err);
    }
    return value;
  },

  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error(err);
    }
  },
};

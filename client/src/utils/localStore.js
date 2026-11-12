export const readList = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const writeList = (key, rows) => {
  localStorage.setItem(key, JSON.stringify(rows));
  return rows;
};

export const addRow = (key, row) => {
  const rows = readList(key);
  const saved = {
    id: row.id || `${key}-${Date.now()}`,
    createdAt: row.createdAt || new Date().toISOString(),
    ...row,
  };
  writeList(key, [saved, ...rows]);
  return saved;
};

export const updateRow = (key, id, patch) => {
  const rows = readList(key).map((row) => (row.id === id ? { ...row, ...patch, updatedAt: new Date().toISOString() } : row));
  writeList(key, rows);
  return rows.find((row) => row.id === id);
};

export const removeRow = (key, id) => {
  const rows = readList(key).filter((row) => row.id !== id);
  writeList(key, rows);
  return rows;
};

const pad = (value) => String(value).padStart(2, '0');

export const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toApiDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
};

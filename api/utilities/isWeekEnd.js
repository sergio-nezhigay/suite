export const isWeekend = () => {
  const today = new Date();
  const day = today.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

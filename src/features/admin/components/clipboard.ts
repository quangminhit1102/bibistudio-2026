export async function copyText(value: string) {
  if (!navigator.clipboard)
    throw new Error("Trình duyệt không hỗ trợ clipboard. Bạn có thể chọn và sao chép đoạn mã.");
  await navigator.clipboard.writeText(value);
}

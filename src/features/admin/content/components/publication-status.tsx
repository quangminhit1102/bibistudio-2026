import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useContent } from "../context";
import type { PublicationJob } from "../contracts";
const labels: Record<PublicationJob["status"], string> = {
  queued: "Đang chờ xuất bản",
  building: "Đang tạo trang",
  prepared: "Đã chuẩn bị bản xuất bản",
  verifying: "Đang kiểm tra website",
  succeeded: "Xuất bản thành công",
  failed: "Xuất bản thất bại",
};
export function PublicationStatus({
  jobId,
  onTerminal,
}: {
  jobId: string;
  onTerminal?: (job: PublicationJob) => void;
}) {
  const { api } = useContent(),
    job = useQuery({
      queryKey: ["bibi-admin", "content", "publication", jobId],
      queryFn: ({ signal }) => {
        if (!api) throw Error("API nội dung chưa sẵn sàng");
        return api.publications.status(jobId, signal);
      },
      refetchInterval: (query) =>
        query.state.data && ["succeeded", "failed"].includes(query.state.data.status)
          ? false
          : 1500,
      retry: false,
    });
  const data = job.data;
  const reported = useRef("");
  useEffect(() => {
    if (data && (data.status === "succeeded" || data.status === "failed")) {
      const key = jobId + ":" + data.status;
      if (reported.current !== key) {
        reported.current = key;
        onTerminal?.(data);
      }
    }
  }, [data, onTerminal, jobId]);
  return (
    <div role="status" className="a-banner">
      {job.error ? (
        <>
          <p>{job.error.message}</p>
          <button type="button" onClick={() => void job.refetch()}>
            Kiểm tra lại trạng thái
          </button>
        </>
      ) : data ? (
        <>
          <p>{labels[data.status]}</p>
          {data.error && <p>{data.error.message}</p>}
        </>
      ) : (
        <p>Đang đọc trạng thái xuất bản…</p>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Popover } from "radix-ui";
import { Bell, Check, Circle, X } from "lucide-react";
import { Button, Card, Skeleton, ErrorState } from "../shared/ui/primitives";
import { internalTarget } from "../shared/lib/navigation";
import { dateTime } from "../shared/lib/text";
import { useNotifications } from "./hooks";
import { safeNotificationLink } from "./service";
function NotificationItems({
  feed,
  onFollow,
  limit,
}: {
  feed: ReturnType<typeof useNotifications>;
  onFollow?: () => void;
  limit?: number;
}) {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  if (feed.query.isPending) return <Skeleton rows={3} />;
  if (feed.query.error)
    return <ErrorState error={feed.query.error} onRetry={() => void feed.query.refetch()} />;
  return (
    <>
      {(feed.error || notice) && (
        <p role="alert" className="a-error">
          {feed.error instanceof Error ? feed.error.message : notice}
        </p>
      )}
      {!feed.items.length && <p>Chưa có thông báo.</p>}
      <div className="a-notification-list">
        {feed.items.slice(0, limit).map((n) => (
          <button
            key={n.id}
            type="button"
            className="a-notification-item"
            disabled={feed.busy}
            aria-label={`${n.isRead ? "Đã đọc" : "Chưa đọc"}: ${n.name}`}
            data-unread={!n.isRead}
            onClick={async () => {
              setNotice("");
              if (!(await feed.read([n.id]))) return;
              if (!n.href) return;
              const target = safeNotificationLink(n.href);
              if (!target) {
                setNotice("Liên kết thông báo không hợp lệ.");
                return;
              }
              onFollow?.();
              if (target.kind === "internal")
                await navigate({
                  ...internalTarget(target.href),
                  hash: new URL(target.href, "https://admin.local").hash.slice(1),
                });
              else window.open(target.href, "_blank", "noopener,noreferrer");
            }}
          >
            <span role="img" aria-label={n.isRead ? "Đã đọc" : "Chưa đọc"}>
              {n.isRead ? <Check size={17} aria-hidden /> : <Circle size={17} aria-hidden />}
            </span>
            <span>
              <strong>{n.name}</strong>
              <span>{n.description}</span>
              <small>{dateTime(n.createdAt)}</small>
            </span>
          </button>
        ))}
      </div>
      {!limit && feed.query.hasNextPage && (
        <Button
          loading={feed.query.isFetchingNextPage}
          onClick={() => void feed.query.fetchNextPage()}
        >
          Xem thêm thông báo
        </Button>
      )}
    </>
  );
}
export function HeaderNotifications() {
  const [open, setOpen] = useState(false);
  const feed = useNotifications();
  if (!feed.allowed) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Thông báo (${feed.unreadCount} chưa đọc)`}>
          <Bell size={17} />
          {feed.unreadCount > 0 && <span className="a-dot" />}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Thông báo"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={`admin-root a-notification-popover ${typeof document !== "undefined" && document.querySelector(".admin-root.dark") ? "dark" : ""}`}
        >
          <header>
            <h2>Thông báo</h2>
            <Popover.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Đóng thông báo">
                <X size={17} />
              </Button>
            </Popover.Close>
          </header>
          <Button
            size="sm"
            variant="ghost"
            disabled={feed.busy || !feed.unreadCount}
            onClick={() => void feed.read("all")}
          >
            Đánh dấu tất cả đã đọc
          </Button>
          <div className="a-notification-scroll">
            <NotificationItems feed={feed} onFollow={() => setOpen(false)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function NotificationSummary() {
  const feed = useNotifications();
  return (
    <Card>
      <h2>Thông báo hệ thống</h2>
      <NotificationItems feed={feed} limit={4} />
      <small>Mở chuông để xem tất cả thông báo.</small>
    </Card>
  );
}

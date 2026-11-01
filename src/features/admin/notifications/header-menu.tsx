import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEntity } from "../services/context";
import { Button, Modal, Skeleton, ErrorState } from "../shared/ui/primitives";
export function HeaderNotifications() {
  const [open, setOpen] = useState(false);
  const query = useEntity("notifications", { page: 1, pageSize: 100 });
  const unread = query.data?.items.filter((n) => !n.read).length ?? 0;
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Thông báo (${unread} chưa đọc)`}
        onClick={() => setOpen(true)}
      >
        <Bell size={17} />
        {unread > 0 && <span className="a-dot" />}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Thông báo workspace">
        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : (
          <div className="a-dialog-body">
            {query.data?.items.slice(0, 5).map((n) => (
              <Link
                key={n.id}
                to={n.href as "/admin"}
                className="a-search-results"
                style={{ display: "block", padding: 10, borderBottom: "1px solid var(--a-border)" }}
                onClick={() => setOpen(false)}
              >
                <strong>{n.name}</strong>
                <small style={{ display: "block" }}>{n.description}</small>
              </Link>
            ))}
            <Link
              to="/admin/notifications"
              className="a-btn"
              onClick={() => setOpen(false)}
              style={{ marginTop: 16 }}
            >
              Tất cả thông báo
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}

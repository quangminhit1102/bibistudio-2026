import { lazy, Suspense, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { EntityKey } from "../../services/contracts";
import { useAdmin } from "../../services/context";
import { Button, Field, Skeleton } from "../ui/primitives";
import { calendarDate } from "../lib/text";
const RichEditor = lazy(() => import("../../content/components/rich-editor"));
const MediaPicker = lazy(() => import("../../content/components/media-picker"));
export interface FormField {
  key: string;
  label: string;
  type:
    | "text"
    | "email"
    | "number"
    | "textarea"
    | "select"
    | "multi-select"
    | "checkbox"
    | "date"
    | "tags"
    | "rich-text"
    | "media";
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  entity?: EntityKey;
  filter?: Record<string, string>;
  full?: boolean;
  description?: string;
}
export type FormValues = Record<string, unknown>;
function RelationField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const runtime = useAdmin();
  const options = useQuery({
    queryKey: ["bibi-admin", "options", field.entity, field.filter],
    queryFn: async () => {
      await runtime.ensure(field.entity!);
      const rows = await runtime.store.list(field.entity!);
      return rows
        .filter((r) =>
          Object.entries(field.filter ?? {}).every(
            ([k, v]) => String((r as unknown as FormValues)[k]) === v,
          ),
        )
        .map((r) => ({ value: r.id, label: "name" in r ? String(r.name) : r.id }));
    },
  });
  if (options.isPending) return <Skeleton rows={1} />;
  if (options.error)
    return (
      <span role="alert" className="a-error">
        Không tải được danh sách.{" "}
        <button type="button" onClick={() => void options.refetch()}>
          Thử lại
        </button>
      </span>
    );
  return (
    <select
      multiple={field.type === "multi-select"}
      value={(value ?? (field.type === "multi-select" ? [] : "")) as string | string[]}
      onChange={(e) =>
        onChange(
          field.type === "multi-select"
            ? Array.from(e.target.selectedOptions, (o) => o.value)
            : e.target.value,
        )
      }
    >
      <option value="" disabled={field.required}>
        Chọn…
      </option>
      {options.data?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function RecordForm({
  fields,
  initial,
  onSave,
  onCancel,
  onDirtyChange,
  saveLabel = "Lưu thay đổi",
  mediaScope = "content",
}: {
  fields: FormField[];
  initial: FormValues;
  onSave: (values: FormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  saveLabel?: string;
  mediaScope?: "content" | "products" | "bookstore";
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({ defaultValues: initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    setError("");
    try {
      await onSave(values);
      reset(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu dữ liệu.");
    } finally {
      setBusy(false);
    }
  });
  return (
    <form onSubmit={submit} noValidate>
      <div className="a-form-grid">
        {fields.map((field) => {
          const rule = {
            required: field.required ? `Vui lòng nhập ${field.label}` : false,
            min:
              field.min !== undefined
                ? { value: field.min, message: `Tối thiểu ${field.min}` }
                : undefined,
            max:
              field.max !== undefined
                ? { value: field.max, message: `Tối đa ${field.max}` }
                : undefined,
            pattern:
              field.type === "email"
                ? { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email không hợp lệ" }
                : undefined,
          };
          const err = errors[field.key]?.message;
          return (
            <div key={field.key} className={field.full ? "a-full" : ""}>
              <Field
                group={field.type === "rich-text" || field.type === "media"}
                label={field.label}
                required={field.required}
                description={field.description}
                error={typeof err === "string" ? err : undefined}
              >
                {field.entity ? (
                  <Controller
                    name={field.key}
                    control={control}
                    rules={rule}
                    render={({ field: f }) => (
                      <RelationField field={field} value={f.value} onChange={f.onChange} />
                    )}
                  />
                ) : field.type === "rich-text" ? (
                  <Controller
                    name={field.key}
                    control={control}
                    rules={rule}
                    render={({ field: f }) => (
                      <Suspense fallback={<Skeleton />}>
                        <RichEditor value={String(f.value ?? "")} onChange={f.onChange} />
                      </Suspense>
                    )}
                  />
                ) : field.type === "media" ? (
                  <Controller
                    name={field.key}
                    control={control}
                    render={({ field: f }) => (
                      <Suspense fallback={<Skeleton rows={1} />}>
                        <MediaPicker
                          scope={mediaScope}
                          max={Array.isArray(initial[field.key]) ? 10 : 1}
                          value={
                            Array.isArray(f.value)
                              ? f.value
                              : typeof f.value === "string"
                                ? [f.value]
                                : []
                          }
                          onChange={(v) =>
                            f.onChange(Array.isArray(initial[field.key]) ? v : (v[0] ?? null))
                          }
                        />
                      </Suspense>
                    )}
                  />
                ) : field.type === "tags" ? (
                  <Controller
                    name={field.key}
                    control={control}
                    render={({ field: f }) => (
                      <input
                        value={Array.isArray(f.value) ? f.value.join(", ") : ""}
                        onChange={(e) =>
                          f.onChange(
                            e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          )
                        }
                        placeholder="Phân cách bằng dấu phẩy"
                      />
                    )}
                  />
                ) : field.type === "textarea" ? (
                  <textarea {...register(field.key, rule)} />
                ) : field.type === "select" ? (
                  <select {...register(field.key, rule)}>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <input type="checkbox" {...register(field.key)} />
                ) : field.type === "date" ? (
                  <Controller
                    name={field.key}
                    control={control}
                    rules={rule}
                    render={({ field: f }) => (
                      <input
                        type="date"
                        value={calendarDate(f.value)}
                        onChange={(e) =>
                          f.onChange(
                            e.target.value
                              ? new Date(e.target.value + "T00:00:00+07:00").toISOString()
                              : null,
                          )
                        }
                      />
                    )}
                  />
                ) : (
                  <input
                    type={field.type}
                    {...register(field.key, {
                      ...rule,
                      setValueAs: (v: unknown) =>
                        field.type === "number"
                          ? Number(v)
                          : field.type === "date"
                            ? v
                              ? new Date(String(v)).toISOString()
                              : null
                            : v,
                    })}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="a-error" role="alert" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}
      <div className="a-form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}

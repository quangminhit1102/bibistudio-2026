import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useAdmin } from "../../services/context";
import { Field, Skeleton } from "../ui/primitives";
import { calendarDate } from "../lib/text";
import type { FormField, FormValues } from "./record-form";

function TagInput({
  value,
  onChange,
  onBlur,
}: {
  value: unknown;
  onChange: (value: string[]) => void;
  onBlur: () => void;
}) {
  const text = Array.isArray(value) ? value.join(", ") : "";
  const [raw, setRaw] = useState(text),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setRaw(text);
  }, [text, focused]);
  return (
    <input
      placeholder="Phân cách bằng dấu phẩy"
      value={raw}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur();
      }}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

function RelationInput({
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
    queryKey: ["bibi-admin", "editor-options", field.entity, field.filter],
    queryFn: async () => {
      await runtime.ensure(field.entity!);
      const rows = await runtime.store.list(field.entity!);
      return rows
        .filter((row) =>
          Object.entries(field.filter ?? {}).every(
            ([key, v]) => String((row as unknown as FormValues)[key]) === v,
          ),
        )
        .map((row) => ({ value: row.id, label: "name" in row ? String(row.name) : row.id }));
    },
  });
  if (options.isPending) return <Skeleton rows={1} />;
  if (options.error)
    return (
      <span role="alert">
        Không tải được danh sách.{" "}
        <button type="button" onClick={() => void options.refetch()}>
          Thử lại
        </button>
      </span>
    );
  const multiple = field.type === "multi-select";
  return (
    <select
      multiple={multiple}
      value={(value ?? (multiple ? [] : "")) as string | string[]}
      onChange={(e) =>
        onChange(multiple ? Array.from(e.target.selectedOptions, (o) => o.value) : e.target.value)
      }
    >
      {!multiple && <option value="">Chọn…</option>}
      {options.data.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
export function EditorFields({
  fields,
  keys,
  onSlugEdit,
}: {
  fields: FormField[];
  keys: string[];
  onSlugEdit?: () => void;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();
  return (
    <>
      {keys.map((key) => {
        const field = fields.find((f) => f.key === key);
        if (!field) return null;
        const rule = {
          required: field.required ? `Vui lòng nhập ${field.label}` : false,
          min:
            field.min === undefined
              ? undefined
              : { value: field.min, message: `Tối thiểu ${field.min}` },
          max:
            field.max === undefined
              ? undefined
              : { value: field.max, message: `Tối đa ${field.max}` },
        };
        const error = errors[key]?.message;
        return (
          <Field
            key={key}
            label={field.label}
            required={field.required}
            error={typeof error === "string" ? error : undefined}
            description={
              key === "slug"
                ? "Đường dẫn chỉ thay đổi khi bạn chỉnh sửa tại đây."
                : field.description
            }
          >
            {field.entity ? (
              <Controller
                control={control}
                name={key}
                rules={rule}
                render={({ field: f }) => (
                  <RelationInput field={field} value={f.value} onChange={f.onChange} />
                )}
              />
            ) : field.type === "select" ? (
              <select {...register(key, rule)}>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                rows={key === "shortDescription" || key === "excerpt" ? 4 : 3}
                {...register(key, rule)}
              />
            ) : field.type === "tags" ? (
              <Controller
                name={key}
                control={control}
                render={({ field: f }) => (
                  <TagInput value={f.value} onChange={f.onChange} onBlur={f.onBlur} />
                )}
              />
            ) : field.type === "date" ? (
              <Controller
                name={key}
                control={control}
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
                type={field.type === "number" ? "number" : "text"}
                {...register(key, {
                  ...rule,
                  onChange: key === "slug" ? onSlugEdit : undefined,
                  setValueAs: (v) => (field.type === "number" ? Number(v) : v),
                })}
              />
            )}
          </Field>
        );
      })}
    </>
  );
}

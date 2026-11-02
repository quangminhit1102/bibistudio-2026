import { componentLabel } from "./labels";
import { componentUsage } from "./usage";
import { useEffect, useId, useState, useRef } from "react";
import { prepareAvatar } from "../accounts/profile-avatar";
import { Button, Field } from "../shared/ui/primitives";
import { Example } from "./example";
import { componentCatalogue } from "./catalogue";
export function FormExample({ name }: { name: string }) {
  const id = useId();
  const [mode, setMode] = useState("default");
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState("");
  const [validating, setValidating] = useState(false);
  const fileTicket = useRef(0);
  useEffect(
    () => () => {
      fileTicket.current++;
    },
    [],
  );
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState(false);
  const [end, setEnd] = useState("");
  useEffect(() => {
    if (!file || name !== "Image Upload") return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, name]);
  const disabled = mode === "disabled";
  const invalid = mode === "invalid";
  const required = mode === "required";
  const props = {
    id,
    disabled,
    required,
    "aria-invalid": invalid,
    "aria-describedby": id + "-help",
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValue(e.target.value),
  };
  let input;
  if (["Checkbox", "Switch / Toggle"].includes(name))
    input = (
      <input
        id={id}
        type="checkbox"
        role={name === "Switch / Toggle" ? "switch" : undefined}
        checked={checked}
        disabled={disabled}
        required={required}
        aria-invalid={invalid}
        onChange={(e) => setChecked(e.target.checked)}
      />
    );
  else if (name === "Radio Group")
    input = (
      <fieldset disabled={disabled}>
        <legend>Chọn định dạng</legend>
        {["A5", "A6"].map((v) => (
          <label key={v}>
            <input
              type="radio"
              name={id}
              value={v}
              required={required}
              checked={value === v}
              onChange={() => setValue(v)}
            />
            {v}
          </label>
        ))}
      </fieldset>
    );
  else if (name === "Select" || name === "Multi Select")
    input = (
      <select
        {...props}
        multiple={name === "Multi Select"}
        value={name === "Multi Select" ? tags : value}
        onChange={(e) =>
          name === "Multi Select"
            ? setTags(Array.from(e.target.selectedOptions, (o) => o.value))
            : setValue(e.target.value)
        }
      >
        <option value="">Chọn bộ sưu tập</option>
        {["Khám phá Việt Nam", "Món ăn Việt Nam", "Động lực"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    );
  else if (name === "Combobox" || name === "Autocomplete")
    input = (
      <>
        <input {...props} list={id + "-options"} placeholder="Tìm thành phố" />
        <datalist id={id + "-options"}>
          {["Đà Nẵng", "Hà Nội", "Đà Lạt", "Sài Gòn"]
            .filter((v) => v.toLocaleLowerCase("vi").includes(value.toLocaleLowerCase("vi")))
            .map((v) => (
              <option key={v} value={v} />
            ))}
        </datalist>
      </>
    );
  else if (name === "Textarea")
    input = <textarea {...props} rows={3} placeholder="Nội dung mô tả" />;
  else if (name === "Date Range Picker")
    input = (
      <div className="a-actions">
        <input {...props} type="date" aria-label="Từ ngày" />
        <input
          type="date"
          aria-label="Đến ngày"
          disabled={disabled}
          required={required}
          min={value}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
    );
  else if (name === "File Upload" || name === "Image Upload")
    input = (
      <>
        <input
          id={id}
          type="file"
          disabled={disabled || validating}
          required={required}
          accept={name === "Image Upload" ? "image/png,image/jpeg,image/webp" : undefined}
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (!selected) return;
            const ticket = ++fileTicket.current;
            setFileError("");
            if (name !== "Image Upload") {
              setFile(selected);
              return;
            }
            setValidating(true);
            try {
              await prepareAvatar(selected);
              if (ticket === fileTicket.current) setFile(selected);
            } catch (e) {
              if (ticket === fileTicket.current)
                setFileError(e instanceof Error ? e.message : "Ảnh không hợp lệ.");
            } finally {
              if (ticket === fileTicket.current) setValidating(false);
            }
          }}
        />
        {file && (
          <small>
            {file.name} · {Math.ceil(file.size / 1024)} KiB · chỉ xem trước
          </small>
        )}
        {name === "Image Upload" && file?.type.startsWith("image/") && url && (
          <img
            src={url}
            alt="Ảnh xem trước"
            style={{ maxWidth: 180, maxHeight: 180, objectFit: "contain" }}
          />
        )}
      </>
    );
  else if (name === "Tag Input")
    input = (
      <>
        <div className="a-actions">
          {tags.map((tag) => (
            <Button
              key={tag}
              size="sm"
              disabled={disabled}
              aria-label={"Xóa thẻ " + tag}
              onClick={() => setTags(tags.filter((t) => t !== tag))}
            >
              {tag} ×
            </Button>
          ))}
        </div>
        <input
          {...props}
          placeholder="Nhập thẻ rồi Enter"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.trim() && !tags.includes(value.trim())) setTags([...tags, value.trim()]);
              setValue("");
            }
          }}
        />
      </>
    );
  else if (name === "Password Input")
    input = (
      <div className="a-actions">
        <input {...props} type={password ? "text" : "password"} autoComplete="new-password" />
        <Button disabled={disabled} aria-pressed={password} onClick={() => setPassword(!password)}>
          {password ? "Ẩn" : "Hiện"}
        </Button>
      </div>
    );
  else if (name === "Input Group")
    input = (
      <div className="a-actions">
        <span>https://</span>
        <input {...props} placeholder="bibistudio.vn" />
      </div>
    );
  else
    input = (
      <input
        {...props}
        type={
          name === "Search Input"
            ? "search"
            : name === "Number Input"
              ? "number"
              : name === "Date Picker"
                ? "date"
                : name === "Time Picker"
                  ? "time"
                  : name === "Slider"
                    ? "range"
                    : "text"
        }
        min={name === "Slider" ? "0" : undefined}
        max={name === "Slider" ? "100" : undefined}
        placeholder="Nhập nội dung"
      />
    );
  return (
    <>
      <div className="a-actions">
        <label>
          Trạng thái{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {["default", "disabled", "invalid", "required"].map((v) => (
              <option key={v} value={v}>
                {
                  (
                    {
                      default: "Bình thường",
                      disabled: "Vô hiệu hóa",
                      invalid: "Không hợp lệ",
                      required: "Bắt buộc",
                    } as Record<string, string>
                  )[v]
                }
              </option>
            ))}
          </select>
        </label>
      </div>
      <Field
        label={componentLabel(name)}
        required={required}
        description="Nhập hoặc chọn để xem giá trị cập nhật."
        error={fileError || (invalid ? "Giá trị chưa hợp lệ. Hãy kiểm tra lại." : undefined)}
      >
        {input}
      </Field>
      <small id={id + "-help"} role="status">
        Giá trị:{" "}
        {name === "Password Input"
          ? value
            ? "••••••••"
            : "chưa nhập"
          : (file?.name ??
            (tags.length
              ? tags.join(", ")
              : ["Checkbox", "Switch / Toggle"].includes(name)
                ? checked
                  ? "Đã chọn"
                  : "Chưa chọn"
                : value || "chưa nhập"))}
        {end ? " → " + end : ""}
      </small>
    </>
  );
}
export default function Forms() {
  return (
    <>
      {componentCatalogue.forms.map((name) => (
        <Example
          key={name}
          name={name}
          description="Kiểm tra trạng thái bình thường, vô hiệu hóa, không hợp lệ và bắt buộc."
          code={componentUsage("forms", name)}
        >
          <FormExample name={name} />
        </Example>
      ))}
    </>
  );
}

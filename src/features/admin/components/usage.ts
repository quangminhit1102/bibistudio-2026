const inputState = 'const [value, setValue] = useState("");\n';
const boolState = "const [checked, setChecked] = useState(false);\n";
const modalState = "const [open, setOpen] = useState(false);\n";
const named: Record<string, string> = {
  "Icon Button":
    '<Button size="icon" aria-label="Thêm sản phẩm" onClick={addProduct}><Plus size={16}/></Button>',
  "Button Group":
    '<div role="group" aria-label="Khoảng ngày">{["Ngày","Tuần","Tháng"].map(v => <Button key={v} onClick={() => setRange(v)}>{v}</Button>)}</div>',
  "Split Button":
    '<div className="a-actions"><Button onClick={saveDraft}>Lưu nháp</Button><ActionMenu label="Tùy chọn lưu" items={[{label:"Lưu và đóng",onSelect:saveAndClose}]}/></div>',
  "Toggle Button":
    boolState +
    "<Button aria-pressed={checked} onClick={() => setChecked(!checked)}>Theo dõi</Button>",
  "Copy Button":
    'const [copied,setCopied] = useState(false);\n<Button onClick={async () => {await navigator.clipboard.writeText("BiBi Studio");setCopied(true);}}>{copied ? "Đã sao chép" : "Sao chép"}</Button>',
  "Loading Button":
    "<Button loading={isSaving} disabled={!isValid} onClick={saveDraft}>Lưu thay đổi</Button>",
  "Dropdown Button":
    '<ActionMenu label="Tùy chọn" items={[{label:"Lưu bản nháp",onSelect:saveDraft},{label:"Xuất CSV",onSelect:exportCsv}]}/>',
  "Password Input":
    inputState +
    'const [show,setShow] = useState(false);\n<Field label="Mật khẩu"><input type={show ? "text" : "password"} value={value} onChange={e => setValue(e.target.value)}/></Field><Button aria-pressed={show} onClick={() => setShow(!show)}>Hiện/ẩn</Button>',
  Checkbox:
    boolState +
    '<Field label="Đang hoạt động"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/></Field>',
  "Switch / Toggle":
    boolState +
    '<Field label="Nhận thông báo"><input role="switch" type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/></Field>',
  "Radio Group":
    inputState +
    '<fieldset><legend>Khổ sổ</legend>{["A5","A6"].map(v => <label key={v}><input type="radio" name="size" checked={value===v} onChange={() => setValue(v)}/>{v}</label>)}</fieldset>',
  Select:
    inputState +
    '<Field label="Bộ sưu tập"><select value={value} onChange={e => setValue(e.target.value)}><option value="">Chọn…</option><option value="vietnam">Khám phá Việt Nam</option></select></Field>',
  "Multi Select":
    'const [ids,setIds] = useState<string[]>([]);\n<Field label="Thể loại"><select multiple value={ids} onChange={e => setIds(Array.from(e.target.selectedOptions,o => o.value))}><option value="travel">Du lịch</option><option value="art">Nghệ thuật</option></select></Field>',
  "Date Range Picker":
    'const [range,setRange] = useState({from:"",to:""});\n<label>Từ<input type="date" value={range.from} onChange={e => setRange({...range,from:e.target.value})}/></label><label>Đến<input type="date" min={range.from} value={range.to} onChange={e => setRange({...range,to:e.target.value})}/></label>',
  "File Upload":
    '<Field label="Chọn file"><input type="file" onChange={e => setFile(e.target.files?.[0])}/></Field><p>{file?.name}</p>',
  "Image Upload":
    '<Field label="Chọn ảnh"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0])}/></Field>\n// Tạo URL.createObjectURL(file) trong effect; revokeObjectURL khi đổi ảnh/unmount.\n{previewUrl && <img src={previewUrl} alt="Ảnh xem trước"/>}',
  "Form Field":
    '<Field label="Tên sản phẩm" required description="Tên hiển thị trong catalogue" error={errors.name}><input required value={name} onChange={e => setName(e.target.value)}/></Field>',
  "Form Label":
    '<label htmlFor="product-name">Tên sản phẩm</label>\n<input id="product-name" required value={name} onChange={e => setName(e.target.value)}/>',
  "Form Description":
    '<label htmlFor="slug">Đường dẫn</label><input id="slug" aria-describedby="slug-help"/>\n<small id="slug-help">Dùng chữ không dấu và dấu gạch ngang.</small>',
  "Form Error":
    '<Field label="Email" error="Email không hợp lệ"><input type="email" aria-invalid="true" value={email} onChange={e => setEmail(e.target.value)}/></Field>',
  "Input Group":
    inputState +
    '<Field label="Website"><div className="a-actions"><span>https://</span><input value={value} onChange={e => setValue(e.target.value)}/></div></Field>',
  "Tag Input":
    'const [tags,setTags] = useState<string[]>([]);\n<input aria-label="Thêm thẻ" onKeyDown={e => {if(e.key==="Enter"){e.preventDefault();const value=e.currentTarget.value.trim();if(value)setTags([...new Set([...tags,value])]);e.currentTarget.value="";}}}/>\n{tags.map(tag => <Button key={tag} aria-label={"Xóa "+tag} onClick={() => setTags(tags.filter(v => v!==tag))}>{tag} ×</Button>)}',
  Table:
    "<table><caption>Tồn kho</caption><thead><tr><th>Sản phẩm</th><th>Số lượng</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.stock}</td></tr>)}</tbody></table>",
  "Data Table":
    "<DataTable<Product> columns={columns} result={result} state={state} onStateChange={setState} selection={selection} onSelectionChange={setSelection} onExport={exportCsv}/>",
  Card: "<Card><h2>Catalogue</h2><p>Quản lý sản phẩm demo.</p><Button onClick={createProduct}>Thêm sản phẩm</Button></Card>",
  Badge:
    '<Badge tone="success">Đã xuất bản</Badge>\n<Badge tone="warning">Nháp</Badge>\n<Badge tone="error">Có lỗi</Badge>',
  Avatar: '<span className="a-avatar" role="img" aria-label="Minh Nguyễn">MN</span>',
  "Avatar Group":
    '<div className="a-actions" aria-label="Nhóm biên tập">{users.map(u => <span key={u.id} className="a-avatar" title={u.name}>{u.initials}</span>)}</div>',
  Separator:
    "<section><h2>Catalogue</h2><p>Nội dung catalogue.</p></section>\n<hr/>\n<section><h2>Nhật ký</h2></section>",
  Progress:
    '<progress aria-label="Tiến độ tải" value={progress} max={100}/><span>{progress}%</span>',
  Skeleton: "{loading ? <Skeleton rows={3}/> : <p>{content}</p>}",
  "Empty State":
    '<EmptyState title="Chưa có sản phẩm" description="Tạo sản phẩm đầu tiên cho bộ sưu tập." action={<Button onClick={createProduct}>Tạo sản phẩm</Button>}/>',
  "Statistic Card":
    '<Kpi title="Sản phẩm" value={50} raw={50} previous={45} description="Số bản ghi trong catalogue demo."/>',
  "Key-Value List":
    '<dl className="a-key-values"><dt>Mã sản phẩm</dt><dd>{product.sku}</dd><dt>Bộ sưu tập</dt><dd>{product.collection}</dd></dl>',
  Timeline:
    '<ol className="a-timeline">{events.map(event => <li key={event.id}>{event.title}<small>{date(event.at)}</small></li>)}</ol>',
  "Status Indicator":
    '<span><span className="a-dot" aria-hidden="true"/>Sẵn sàng</span>\n<Badge tone="warning">Đang xử lý</Badge>',
  "Code Block": "<pre><code>{'const products = await api.products.list(input);'}</code></pre>",
  "Image Preview":
    modalState +
    '<button aria-label="Phóng to ảnh" onClick={() => setOpen(true)}><img src={src} alt={alt}/></button><Modal open={open} onOpenChange={setOpen} title={alt}><img src={src} alt={alt}/></Modal>',
  Sidebar:
    '<aside><nav aria-label="Quản trị"><Link to="/admin/dashboard">Tổng quan</Link><Link to="/admin/products/list">Sản phẩm</Link></nav></aside>',
  "Navigation Menu":
    '<nav aria-label="Module"><Link to="/admin/products/list">Catalogue</Link><Link to="/admin/content/posts">Nội dung</Link></nav>',
  Breadcrumb:
    '<nav aria-label="Breadcrumb"><Link to="/admin/dashboard">Workspace</Link> / <Link to="/admin/products/list">Sản phẩm</Link> / <span aria-current="page">{product.name}</span></nav>',
  Tabs: '<Tabs.Root defaultValue="catalogue"><Tabs.List aria-label="Module"><Tabs.Trigger value="catalogue">Catalogue</Tabs.Trigger><Tabs.Trigger value="content">Nội dung</Tabs.Trigger></Tabs.List><Tabs.Content value="catalogue">Danh sách sản phẩm</Tabs.Content><Tabs.Content value="content">Danh sách bài viết</Tabs.Content></Tabs.Root>',
  Pagination:
    '<nav aria-label="Phân trang"><Button disabled={page===1} onClick={() => setPage(page-1)}>Trước</Button><span>Trang {page}</span><Button disabled={page===pageCount} onClick={() => setPage(page+1)}>Sau</Button></nav>',
  "Dropdown Menu":
    '<ActionMenu label="Thao tác bản ghi" items={[{label:"Chỉnh sửa",onSelect:edit},{label:"Xóa",danger:true,onSelect:confirmDelete}]}/>',
  "Context Menu":
    "<ContextMenu.Root><ContextMenu.Trigger tabIndex={0}>Nhấp phải hoặc Shift+F10</ContextMenu.Trigger><ContextMenu.Portal><ContextMenu.Content><ContextMenu.Item onSelect={copy}>Sao chép</ContextMenu.Item></ContextMenu.Content></ContextMenu.Portal></ContextMenu.Root>",
  Menubar:
    "<Menubar.Root><Menubar.Menu><Menubar.Trigger>Tệp</Menubar.Trigger><Menubar.Portal><Menubar.Content><Menubar.Item onSelect={createDraft}>Tạo bản nháp</Menubar.Item></Menubar.Content></Menubar.Portal></Menubar.Menu></Menubar.Root>",
  Stepper:
    '<ol aria-label="Tiến trình">{steps.map((step,i) => <li key={step}><Button aria-current={current===i ? "step" : undefined} onClick={() => setCurrent(i)}>{i+1}. {step}</Button></li>)}</ol>',
  Accordion:
    '<Accordion.Root type="single" collapsible><Accordion.Item value="details"><Accordion.Header><Accordion.Trigger>Chi tiết</Accordion.Trigger></Accordion.Header><Accordion.Content>Nội dung sản phẩm</Accordion.Content></Accordion.Item></Accordion.Root>',
  Collapsible:
    "<details><summary>Thông tin thêm</summary><p>Nội dung có thể đóng/mở bằng bàn phím.</p></details>",
  "Collapsible Navigation":
    '<nav aria-label="Quản trị"><details><summary>Catalogue</summary><Link to="/admin/products/list">Sản phẩm</Link><Link to="/admin/bookstore/books">Sách</Link></details></nav>',
  "Expandable List":
    'const [expanded,setExpanded] = useState(false);\n<ul>{(expanded ? items : items.slice(0,3)).map(item => <li key={item.id}>{item.name}</li>)}</ul><Button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Thu gọn" : "Xem thêm"}</Button>',
  "Tree View":
    '<div role="tree" aria-label="Bộ sưu tập" onKeyDown={handleTreeArrowKeys}><button role="treeitem" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Việt Nam</button>{expanded && <div role="group"><button role="treeitem" aria-selected={selected==="danang"} onClick={() => setSelected("danang")}>Đà Nẵng</button></div>}</div>\n// handleTreeArrowKeys chuyển focus Up/Down/Home/End; Left/Right đóng/mở node.',
  "Details Panel":
    "<details><summary>Chi tiết sản phẩm</summary><dl><dt>SKU</dt><dd>{product.sku}</dd><dt>Trạng thái</dt><dd>{product.status}</dd></dl></details>",
  "Alert Dialog":
    '<AlertDialog.Root><AlertDialog.Trigger asChild><Button variant="destructive">Xóa</Button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay/><AlertDialog.Content><AlertDialog.Title>Xóa bản nháp?</AlertDialog.Title><AlertDialog.Description>Thao tác không thể hoàn tác.</AlertDialog.Description><AlertDialog.Cancel>Hủy</AlertDialog.Cancel><AlertDialog.Action onClick={removeDraft}>Xác nhận</AlertDialog.Action></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>',
  "Confirmation Dialog":
    modalState +
    '<ConfirmDialog open={open} title="Xác nhận xóa?" description="Kiểm tra liên kết trước khi xóa." onCancel={() => setOpen(false)} onConfirm={async () => {await removeDraft();setOpen(false);}}/>',
  Popover:
    "<Popover.Root><Popover.Trigger asChild><Button>Chỉnh nhanh</Button></Popover.Trigger><Popover.Portal><Popover.Content><label>Tên<input value={name} onChange={e => setName(e.target.value)}/></label><Popover.Close asChild><Button onClick={save}>Lưu</Button></Popover.Close></Popover.Content></Popover.Portal></Popover.Root>",
  "Hover Card":
    '<HoverCard.Root><HoverCard.Trigger asChild><a href="#profile">Minh Nguyễn</a></HoverCard.Trigger><HoverCard.Portal><HoverCard.Content><strong>Minh Nguyễn</strong><p>Biên tập catalogue</p></HoverCard.Content></HoverCard.Portal></HoverCard.Root>',
  Tooltip:
    '<Tooltip label="Đánh dấu xem lại"><Button aria-label="Đánh dấu" onClick={bookmark}><Heart size={16}/></Button></Tooltip>',
  Alert:
    '<div role="alert" className="a-info-banner">Nội dung chưa được lưu. Kiểm tra biểu mẫu trước khi tiếp tục.</div>',
  Spinner:
    '<span role="status"><LoaderCircle className="a-spin" aria-hidden="true"/>Đang xử lý…</span>',
  "Skeleton Loading": "{loading ? <Skeleton rows={4}/> : <ProductList rows={rows}/>}",
  "Error State": "<ErrorState error={error} onRetry={refetch}/>",
  "Retry State":
    "{error ? <ErrorState error={error} onRetry={() => void refetch()}/> : <p>Đã tải dữ liệu.</p>}",
  "Confirmation Feedback":
    modalState +
    '<ConfirmDialog open={open} title="Hoàn tất?" description="Lưu thay đổi trước khi đóng." onCancel={() => setOpen(false)} onConfirm={async () => {await save();notify("Đã lưu.");setOpen(false);}}/>',
};
export function componentUsage(category: string, name: string): string {
  if (named[name]) return named[name];
  if (category === "actions")
    return '<Button variant="primary" size="md" loading={isSaving} disabled={!isValid} onClick={save}>Lưu thay đổi</Button>';
  if (category === "forms") {
    if (name === "Combobox" || name === "Autocomplete")
      return (
        inputState +
        '<Field label="Thành phố"><input list="cities" value={value} onChange={e => setValue(e.target.value)}/><datalist id="cities"><option value="Đà Nẵng"/><option value="Đà Lạt"/></datalist></Field>'
      );
    const type: Record<string, string> = {
      "Search Input": "search",
      "Number Input": "number",
      "Date Picker": "date",
      "Time Picker": "time",
      Slider: "range",
    };
    return (
      inputState +
      '<Field label="' +
      name +
      '">' +
      (name === "Textarea"
        ? "<textarea value={value} onChange={e => setValue(e.target.value)}/>"
        : '<input type="' +
          (type[name] ?? "text") +
          '" value={value} onChange={e => setValue(e.target.value)}/>') +
      "</Field>"
    );
  }
  if (name === "Command Palette" || name === "Command Dialog")
    return (
      modalState +
      '<Modal open={open} onOpenChange={setOpen} title="Tìm hành động"><input aria-label="Tìm lệnh" value={query} onChange={e => setQuery(e.target.value)}/>{commands.filter(c => c.label.includes(query)).map(c => <Button key={c.id} onClick={() => {c.run();setOpen(false);}}>{c.label}</Button>)}</Modal>'
    );
  if (
    name === "Dialog" ||
    name === "Drawer" ||
    name === "Sheet" ||
    name === "Mobile Navigation Drawer"
  )
    return (
      modalState +
      "<Button onClick={() => setOpen(true)}>Mở " +
      name +
      '</Button><Modal open={open} onOpenChange={setOpen} placement="' +
      (name === "Drawer" || name === "Mobile Navigation Drawer"
        ? "left"
        : name === "Sheet"
          ? "right"
          : "center") +
      '" title="' +
      name +
      '"><p>Nội dung hộp thoại.</p><Button onClick={() => setOpen(false)}>Đóng</Button></Modal>'
    );
  if (name === "Progress Bar") return named.Progress;
  if (category === "feedback")
    return (
      'const notify = useNotice();\n<Button onClick={() => notify("' +
      (name === "Error Notification"
        ? "Chưa lưu được dữ liệu."
        : name === "Warning Notification"
          ? "Còn thay đổi chưa lưu."
          : "Đã lưu thay đổi.") +
      '","' +
      (name === "Error Notification"
        ? "error"
        : name === "Warning Notification"
          ? "info"
          : "success") +
      '")}>Hiện thông báo</Button>'
    );
  const kinds: Record<string, string> = {
    "Line Chart": "line",
    "Area Chart": "area",
    "Bar Chart": "bar",
    "Pie Chart": "pie",
    "Donut Chart": "donut",
    "Multi-Series Chart": "multi-series",
    "Mini Sparkline": "sparkline",
  };
  if (category === "charts")
    return (
      '<Chart kind="' +
      kinds[name] +
      '" data={[{name:"T2",value:15,secondary:8},{name:"T3",value:32,secondary:19}]} label="Lượt xem demo theo ngày"/>'
    );
  throw new Error("Thiếu mã ví dụ cho " + name);
}

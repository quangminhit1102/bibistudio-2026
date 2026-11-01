# MASTER PROMPT — MODERN MINIMALIST ADMIN DASHBOARD

## 1. ROLE & OBJECTIVE

You are a Principal Frontend Engineer, Senior UI/UX Designer, and Software Architect with extensive experience building production-grade enterprise admin applications.

Your mission is to design and implement a complete, modern, highly polished, and reusable **Admin Dashboard & UI Component System**.

The application must be inspired by the design principles of:

- Linear — Minimalism, clarity, refined navigation.
- Vercel Dashboard — Professional layouts and visual hierarchy.
- shadcn/ui — Accessible, reusable components.
- Notion — Excellent content organization.
- Stripe Dashboard — Professional data tables and business workflows.

**Primary design direction: MODERN MINIMALIST.**

This is not a simple static UI showcase.

Build a functional administrative application featuring realistic management workflows, reusable components, comprehensive demo data, and clean architecture.

The finished application should serve as a reusable foundation for future websites, including e-commerce, content management, bookstores, and enterprise management systems.

---

# 2. RECOMMENDED TECHNOLOGY STACK

Use the following technologies unless an existing repository already has compatible conventions:

| Technology | Purpose |
|---|---|
| React | Frontend framework |
| TypeScript | Type safety |
| Vite | Development and build tooling |
| Tailwind CSS | Styling and design tokens |
| shadcn/ui | Component foundation |
| Radix UI | Accessible UI primitives |
| Lucide React | Icons |
| React Router | Routing |
| TanStack Query | Server-state management |
| TanStack Table | Advanced data tables |
| React Hook Form | Form management |
| Zod | Schema validation |
| Zustand | Lightweight application state |
| Recharts | Data visualization |
| date-fns | Date utilities |

Architecture requirements:

- TypeScript strict mode.
- Functional React components.
- Feature-based modular organization.
- Reusable hooks and services.
- Shared typed domain models.
- Centralized design tokens.
- No unnecessary dependencies.
- No duplicated business logic.
- No monolithic components.

Frontend must be decoupled from backend implementation.

Prepare an API abstraction layer compatible with future ASP.NET Core REST API integration.

Use a mock API implementation by default.

The application must run without requiring a backend.

---

# 3. DESIGN SYSTEM — MODERN MINIMALIST

## 3.1 Visual Identity

Design a premium administrative interface with:

- Clean, minimal layouts.
- Subtle neutral backgrounds.
- Precise spacing.
- Beautiful typography.
- Elegant data tables.
- Thin borders.
- Minimal shadows.
- Consistent iconography.
- Refined hover interactions.
- Excellent visual hierarchy.
- Professional information density.

Avoid:

- Excessive gradients.
- Glassmorphism everywhere.
- Oversized rounded corners.
- Overly colorful dashboards.
- Unnecessary animations.
- Heavy drop shadows.
- Decorative elements without functional value.
- Generic-looking template layouts.

## 3.2 Color Palette

Light Mode:

- Main Background: `#FFFFFF`
- Secondary Background: `#FAFAFA`
- Sidebar Background: `#FCFCFC`
- Primary Text: `#171717`
- Secondary Text: `#737373`
- Border: `#E5E5E5`
- Primary Action: `#18181B`
- Success: `#16A34A`
- Warning: `#D97706`
- Error: `#DC2626`
- Info: `#2563EB`

Dark Mode:

- Main Background: `#09090B`
- Secondary Background: `#18181B`
- Primary Text: `#FAFAFA`
- Secondary Text: `#A1A1AA`
- Border: `#27272A`

Use semantic CSS variables instead of hardcoded component colors.

## 3.3 Typography

Recommended font: Inter or Geist.

Typography requirements:

- Consistent hierarchy.
- Compact but readable table typography.
- Clear headings and section descriptions.
- Proper line heights.
- Consistent font weights.
- Support for Vietnamese characters.

## 3.4 Layout

Desktop:

- Collapsible left sidebar.
- Top navigation bar.
- Breadcrumb navigation.
- Main content container.
- Responsive data sections.
- Right-side contextual panels where appropriate.

Sidebar:

- Brand logo.
- Main navigation groups.
- Active route highlighting.
- Collapsible menu sections.
- Tooltip support when collapsed.
- User profile area.
- Logout action.

Header:

- Breadcrumbs.
- Global search.
- Keyboard shortcut indicator.
- Notification menu.
- Theme switcher.
- User account dropdown.

Responsive behavior:

- Desktop: Full sidebar.
- Tablet: Collapsible sidebar.
- Mobile: Drawer navigation.
- No horizontal page overflow.
- Tables support responsive scrolling.

---

# 4. APPLICATION PAGES & ROUTING

Implement the following route structure.

```text
/
├── dashboard
├── analytics
│   ├── overview
│   ├── visitors
│   ├── sessions
│   ├── pages
│   └── traffic-sources
├── products
│   ├── list
│   ├── create
│   ├── :id/edit
│   ├── categories
│   └── inventory
├── bookstore
│   ├── books
│   ├── authors
│   ├── publishers
│   ├── genres
│   └── inventory
├── sales
│   ├── orders
│   ├── order-history
│   ├── transactions
│   └── reports
├── accounts
│   ├── users
│   ├── roles
│   └── permissions
├── content
│   ├── posts
│   ├── categories
│   ├── tags
│   └── media
├── audit-logs
├── notifications
├── settings
│   ├── general
│   ├── appearance
│   ├── security
│   └── profile
└── components
    ├── overview
    ├── actions
    ├── forms
    ├── data-display
    ├── navigation
    ├── overlays
    └── feedback
```

Every route must render an actual page.

Do not leave placeholder pages containing only a title.

---

# 5. DASHBOARD OVERVIEW

Create a beautiful dashboard featuring a modern Bento-inspired layout while preserving minimalist styling.

## KPI Cards

Display:

1. Total Revenue
2. Total Orders
3. Total Products
4. Total Visitors
5. Active Users
6. Conversion Rate

Each card should contain:

- Metric title.
- Metric value.
- Percentage change.
- Comparison against the previous period.
- Optional trend visualization.
- Tooltip explaining the metric.

## Charts

Implement:

- Revenue Trend
- Orders Over Time
- Visitors Over Time
- Sales by Category
- Traffic Source Distribution
- Top Selling Products

Charts must support:

- Date range selection.
- Responsive resizing.
- Tooltip interactions.
- Empty states.
- Loading states.

## Additional Dashboard Sections

Include:

- Recent Orders
- Recent Activity
- Low Stock Products
- Top Selling Products
- Recent Visitors
- System Notifications

Implement date filters:

- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Custom Date Range

---

# 6. WEBSITE VISITOR ANALYTICS

Build a professional visitor tracking dashboard inspired by web analytics platforms.

The purpose is to monitor website visits and understand traffic behavior.

## 6.1 Visitor Statistics

Display:

- Total Visits
- Unique Visitors
- Active Sessions
- Page Views
- Average Session Duration
- Bounce Rate
- New vs Returning Visitors
- Visits by Country
- Visits by Device
- Visits by Browser

## 6.2 Visitor Table

Create an advanced table with these columns:

| Column | Description |
|---|---|
| Visitor ID | Anonymous visitor identifier |
| IP Address | Visitor IP, if legitimately available |
| Country | Approximate country |
| City | Approximate city |
| Device | Desktop, Mobile, Tablet |
| Browser | Chrome, Edge, Safari, etc. |
| Operating System | Windows, macOS, Android, iOS |
| Referrer | Source website |
| Landing Page | First visited page |
| Last Page | Most recent page |
| First Seen | First recorded visit |
| Last Seen | Most recent activity |
| Sessions | Number of sessions |
| Page Views | Number of pages viewed |

## 6.3 Visitor Detail Page

When an administrator clicks a visitor row, open a detailed view displaying:

- Anonymous visitor identifier.
- IP address, if available.
- Approximate geographical information.
- Device and browser details.
- Session history.
- Visited pages.
- Entry and exit pages.
- Referral source.
- Visit timestamps.
- Page view timeline.

## 6.4 Visitor Tracking Architecture

Provide a clean interface for connecting real analytics data later.

Define models such as:

```typescript
interface Visitor {
  id: string;
  anonymousId: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  pageViewCount: number;
}

interface VisitorSession {
  id: string;
  visitorId: string;
  startedAt: string;
  endedAt?: string;
  landingPage: string;
  exitPage?: string;
  referrer?: string;
  pageViews: number;
}
```

Important requirements:

- The frontend alone cannot reliably discover a public visitor IP.
- Real IP collection and geo-enrichment require an appropriate backend or analytics provider.
- Never claim to identify a real person solely from an IP address.
- IP geolocation is approximate.
- Do not invent sensitive information.
- Do not create a real-time tracking system that secretly collects personal information.
- Support applicable consent, disclosure, retention, and privacy requirements.
- Use masked IP addresses where appropriate.
- Restrict analytics access to authorized administrators.
- Display clearly labeled simulated data in demo mode.

Use realistic mock analytics records for the demo.

## 6.5 Analytics Filters

Implement:

- Search by Visitor ID.
- Search by IP.
- Filter by Country.
- Filter by Device.
- Filter by Browser.
- Filter by Date.
- Sort by Last Visit.
- Export filtered results to CSV.

## 6.6 Additional Analytics Views

Build:

- Country distribution chart.
- Device distribution chart.
- Browser distribution chart.
- Top visited pages.
- Traffic sources.
- Session activity timeline.

---

# 7. PRODUCT MANAGEMENT

Create a fully interactive product management module.

## Product List

Columns:

- Checkbox
- Product Image
- SKU
- Product Name
- Category
- Price
- Stock Quantity
- Status
- Created Date
- Actions

Features:

- Search products.
- Advanced filters.
- Sort columns.
- Server-compatible pagination.
- Change page size.
- Select multiple products.
- Bulk actions.
- Add product.
- Edit product.
- View product details.
- Delete product.
- Duplicate product.
- Update product status.
- Export products.

## Product Form

Fields:

- Name
- SKU
- Slug
- Description
- Short Description
- Category
- Price
- Compare-at Price
- Stock Quantity
- Product Status
- Product Images
- Tags
- SEO Title
- SEO Description

Implement:

- React Hook Form.
- Zod validation.
- Field-level error messages.
- Image preview.
- Multi-image support.
- Drag-and-drop upload interface.
- Save draft.
- Publish.
- Cancel.
- Unsaved changes warning.

In demo mode, persist changes to local storage or IndexedDB.

Do not pretend that simulated image uploads are server uploads.

---

# 8. BOOKSTORE MANAGEMENT

Build an independent bookstore demo module demonstrating reusable management components.

## Books Management

Fields:

- ISBN
- Book Title
- Cover Image
- Author
- Publisher
- Genre
- Publication Year
- Language
- Price
- Stock
- Status

Features:

- Add Book
- Edit Book
- Delete Book
- View Details
- Search by ISBN
- Filter by Author
- Filter by Genre
- Filter by Publisher
- Filter by Availability
- Bulk Updates

## Authors Management

Fields:

- Author Name
- Biography
- Nationality
- Date of Birth
- Number of Books

## Publishers Management

Fields:

- Publisher Name
- Country
- Contact Information
- Number of Published Books

## Book Inventory

Implement:

- Current Stock.
- Low Stock.
- Out of Stock.
- Stock Adjustment.
- Inventory History.

Create realistic relationships between books, authors, publishers, and genres.

Use shared components from Product Management wherever possible.

---

# 9. SALES & ORDER HISTORY

Build a complete sales management demo.

## Sales Dashboard

Display:

- Total Sales
- Total Orders
- Average Order Value
- Pending Orders
- Completed Orders
- Cancelled Orders

## Order List

Columns:

- Order Number
- Customer
- Number of Items
- Total Amount
- Payment Status
- Order Status
- Order Date
- Actions

Order statuses:

- Pending
- Confirmed
- Processing
- Shipped
- Delivered
- Cancelled
- Refunded

Payment statuses:

- Pending
- Paid
- Failed
- Refunded

## Order Details

Include:

- Customer information.
- Ordered products.
- Quantities.
- Unit prices.
- Subtotal.
- Discounts.
- Shipping.
- Total.
- Payment information.
- Order status timeline.
- Internal notes.

## Order Actions

Implement:

- View order.
- Update status.
- Filter history.
- Search orders.
- Export CSV.
- Print order details.
- Cancel order with confirmation.

Maintain consistency between order items, totals, and summary statistics.

Prevent invalid order status transitions.

---

# 10. ACCOUNT & USER MANAGEMENT

Build a professional user management interface.

## User List

Columns:

- Avatar
- Full Name
- Email
- Role
- Account Status
- Last Login
- Created Date
- Actions

## User Management

Implement:

- Create User
- Edit User
- View User
- Activate User
- Deactivate User
- Delete User
- Assign Role
- Search Users
- Filter Users

## Roles

Create demo roles:

- Super Admin
- Administrator
- Manager
- Editor
- Viewer

## Permissions

Define:

- View
- Create
- Update
- Delete
- Export
- Manage Settings

Implement a permissions matrix.

Use typed permission definitions.

Hide or disable unauthorized actions in the UI.

Clearly document that frontend permission checks are for user experience only; real authorization must be enforced by the backend.

## Demo Authentication

Provide a clearly labeled demo authentication flow.

Support role switching for testing UI permissions.

Do not use hardcoded production credentials.

Do not represent simulated authentication as production security.

---

# 11. POST & CONTENT MANAGEMENT

Build a complete blog CMS module.

## Post List

Columns:

- Featured Image
- Title
- Author
- Category
- Status
- Created Date
- Published Date
- Actions

Features:

- Create post.
- Edit post.
- Delete post.
- Duplicate post.
- Search.
- Filter.
- Sort.
- Bulk actions.

## Post Editor

Fields:

- Title
- Slug
- Excerpt
- Content
- Featured Image
- Category
- Tags
- Author
- Status
- Publish Date
- SEO Title
- SEO Description

Use a rich text editor supporting:

- Headings.
- Bold.
- Italic.
- Links.
- Lists.
- Blockquotes.
- Code blocks.
- Images.

Features:

- Save draft.
- Publish.
- Unpublish.
- Preview.
- Edit existing post.
- Unsaved changes warning.

Sanitize rendered rich text and do not trust imported HTML.

---

# 12. CATEGORY & MEDIA MANAGEMENT

## Category Management

Implement:

- Category List
- Create Category
- Edit Category
- Delete Category
- Parent Category
- Slug
- Description
- Display Order
- Active Status

Support hierarchical categories.

Prevent invalid parent-child relationships and cyclic category structures.

## Media Library

Create a reusable media management UI.

Features:

- Grid view.
- List view.
- Image preview.
- File metadata.
- Search files.
- Filter by type.
- Multi-select.
- Delete confirmation.
- Upload interface.
- Drag-and-drop interaction.

In demo mode, use local previews and clearly indicate which files are not uploaded to a server.

---

# 13. COMPLETE REUSABLE COMPONENT LIBRARY

This is a critical requirement.

Create a dedicated **UI Components Showcase** page.

Every component must be implemented and demonstrated.

Do not merely install a component library and consider the task finished.

Create reusable application-level components, variants, examples, and documentation.

## 13.1 Actions

Implement:

- Button
- Icon Button
- Button Group
- Split Button
- Toggle Button
- Copy Button
- Loading Button
- Dropdown Button

Button variants:

- Primary
- Secondary
- Outline
- Ghost
- Destructive
- Link

Button sizes:

- Small
- Medium
- Large
- Icon Only

Support:

- Disabled state.
- Loading state.
- Keyboard interaction.
- Focus state.
- Icons.
- Accessible labels.

## 13.2 Form Components

Implement:

- Input
- Password Input
- Search Input
- Textarea
- Number Input
- Checkbox
- Radio Group
- Switch / Toggle
- Select
- Multi Select
- Combobox
- Autocomplete
- Date Picker
- Date Range Picker
- Time Picker
- Slider
- File Upload
- Image Upload
- Form Field
- Form Label
- Form Description
- Form Error
- Input Group
- Tag Input

Each form component must demonstrate:

- Default.
- Disabled.
- Invalid.
- Required.
- Controlled usage where applicable.

## 13.3 Data Display

Implement:

- Table
- Data Table
- Card
- Badge
- Avatar
- Avatar Group
- Tooltip
- Popover
- Separator
- Progress
- Skeleton
- Empty State
- Statistic Card
- Key-Value List
- Timeline
- Status Indicator
- Code Block
- Image Preview

## 13.4 Advanced Data Table

Build a reusable DataTable component with:

- Typed column definitions.
- Sorting.
- Filtering.
- Search.
- Pagination.
- Row selection.
- Bulk actions.
- Column visibility.
- Column resizing where appropriate.
- Row action menus.
- Loading skeleton.
- Empty state.
- Error state.
- Export action.
- Responsive behavior.

Support both:

1. Client-side data processing.
2. Server-side pagination, filtering, and sorting interfaces.

Avoid duplicating table implementations across management pages.

## 13.5 Navigation

Implement:

- Sidebar
- Navigation Menu
- Breadcrumb
- Tabs
- Pagination
- Dropdown Menu
- Context Menu
- Menubar
- Command Palette
- Stepper
- Collapsible Navigation
- Mobile Navigation Drawer

## 13.6 Disclosure Components

Implement:

- Accordion
- Collapsible
- Expandable List
- Tree View
- Details Panel

## 13.7 Overlay Components

Implement:

- Dialog
- Alert Dialog
- Confirmation Dialog
- Drawer
- Sheet
- Popover
- Hover Card
- Tooltip
- Dropdown Menu
- Command Dialog

All overlays must support accessible focus management and keyboard dismissal where appropriate.

## 13.8 Feedback Components

Implement:

- Toast
- Success Notification
- Error Notification
- Warning Notification
- Alert
- Progress Bar
- Spinner
- Skeleton Loading
- Empty State
- Error State
- Retry State
- Confirmation Feedback

## 13.9 Charts

Implement reusable wrappers for:

- Line Chart
- Area Chart
- Bar Chart
- Pie Chart
- Donut Chart
- Multi-Series Chart
- Mini Sparkline

All charts should follow the global design system.

---

# 14. COMPONENT SHOWCASE PAGE

Create a dedicated route:

`/components`

The purpose is to provide a visual catalog of every reusable component in the application.

The page should resemble a professional internal design system.

Organize components into categories:

- Actions
- Forms
- Data Display
- Navigation
- Overlays
- Feedback
- Charts

Each component demonstration should contain:

1. Component name.
2. Short description.
3. Interactive preview.
4. Available variants.
5. Disabled/loading/error states where relevant.
6. TypeScript usage example.
7. Copy code button.

Example:

### Button Component

Show:

- Primary Button
- Secondary Button
- Outline Button
- Ghost Button
- Destructive Button
- Loading Button
- Disabled Button
- Button with Icon

Include real interactions.

Every interactive showcase example must do something meaningful.

---

# 15. DATA & MOCK BACKEND

The application must be fully usable in demo mode.

Build a realistic mock data layer.

Required datasets:

- Products
- Categories
- Books
- Authors
- Publishers
- Orders
- Order Items
- Users
- Roles
- Permissions
- Posts
- Visitors
- Sessions
- Analytics Events
- Audit Logs
- Notifications

Generate realistic, internally consistent sample records.

Suggested initial data volumes:

- 50 Products
- 30 Books
- 15 Authors
- 10 Publishers
- 100 Orders
- 30 Users
- 40 Posts
- 200 Visitor Sessions

Use stable identifiers and deterministic seed data where practical.

Do not rely on unrelated random values that produce inconsistent statistics.

Implement mock service functions returning promises.

Simulate realistic latency.

Support:

- Read.
- Create.
- Update.
- Delete.
- Filter.
- Sort.
- Pagination.

Persist demo changes locally.

Provide a Reset Demo Data action.

Separate seed data from application logic.

Provide clear extension points for replacing mock services with real HTTP API services.

---

# 16. APPLICATION STATE & USER EXPERIENCE

Implement professional UX behavior.

## 16.1 Loading

Every data-heavy page should have:

- Loading skeleton.
- Content state.
- Empty state.
- Error state.
- Retry action.

## 16.2 Notifications

Use toast notifications for:

- Successful creation.
- Successful update.
- Successful deletion.
- Validation failures.
- Failed operations.

## 16.3 Confirmation

Require confirmation before destructive actions.

## 16.4 Search

Provide:

- Global application search UI.
- Page-specific searching.
- Debounced search input.

Global search must search meaningful demo entities or be clearly labeled as a limited demo.

## 16.5 Pagination

All large tables must support:

- Current page.
- Page size.
- Total records.
- Previous.
- Next.
- First.
- Last.

## 16.6 Filtering

Support advanced filtering for relevant pages.

Persist relevant filter state in URL query parameters where practical.

## 16.7 Forms

Implement:

- Validation.
- Clear error messages.
- Success feedback.
- Reset actions.
- Unsaved changes protection.
- Accessible labels.

---

# 17. PROJECT STRUCTURE

Follow a clean feature-based architecture.

Suggested structure:

```text
src/
├── app/
│   ├── providers/
│   ├── router/
│   └── layouts/
├── components/
│   ├── ui/
│   ├── shared/
│   ├── forms/
│   ├── tables/
│   ├── charts/
│   └── feedback/
├── features/
│   ├── dashboard/
│   ├── analytics/
│   ├── products/
│   ├── bookstore/
│   ├── sales/
│   ├── accounts/
│   ├── content/
│   ├── audit-logs/
│   └── settings/
├── hooks/
├── services/
│   ├── api/
│   ├── mock/
│   └── interfaces/
├── store/
├── types/
├── schemas/
├── lib/
├── constants/
├── styles/
└── main.tsx
```

Within each feature, separate:

- Pages
- Components
- Hooks
- Services
- Types
- Validation Schemas

Avoid creating a giant shared folder containing unrelated business logic.

---

# 18. ACCESSIBILITY

Accessibility is mandatory.

Implement:

- Semantic HTML.
- Accessible form labels.
- Keyboard navigation.
- Visible focus indicators.
- Accessible dialog behavior.
- Proper ARIA attributes.
- Sufficient color contrast.
- Screen-reader-friendly controls.
- Reduced motion support.

Prefer established accessible primitives.

---

# 19. RESPONSIVENESS

The application must work at:

- 375px mobile width.
- 768px tablet width.
- 1024px laptop width.
- 1440px desktop width.
- 1920px large-screen width.

Ensure:

- Sidebar adapts correctly.
- Tables remain usable.
- Cards rearrange naturally.
- Dialogs fit smaller screens.
- Forms remain readable.
- No broken layouts.

---

# 20. PERFORMANCE

Apply:

- Route-level code splitting.
- Lazy loading where appropriate.
- Memoization only when beneficial.
- Debounced searching.
- Efficient table rendering.
- Stable React keys.
- Appropriate caching.
- No unnecessary re-renders.

Optimize for maintainability first, then performance based on actual usage.

---

# 21. TESTING & QUALITY

Implement automated tests for critical behavior.

Priority tests:

- Routing.
- Product CRUD.
- Book CRUD.
- Order status transitions.
- User role and permission UI.
- Form validation.
- Table filtering.
- Table pagination.
- Search.
- Theme switching.
- Demo data persistence.
- Reset demo data.

Use suitable modern React testing tools.

Check:

- TypeScript compilation.
- Linting.
- Production build.
- Basic accessibility.
- Responsive behavior.
- Critical user flows.

Do not claim tests pass unless they were actually executed successfully.

---

# 22. DEVELOPMENT EXECUTION STRATEGY

Implement the application in phases.

## Phase 1 — Foundation

- Project setup.
- Dependencies.
- Design tokens.
- Theme system.
- Routing.
- Application layout.
- Sidebar.
- Header.
- Shared providers.

## Phase 2 — Component Library

- Core components.
- Forms.
- Data tables.
- Navigation.
- Overlays.
- Feedback.
- Charts.
- Components showcase.

## Phase 3 — Core Management

- Dashboard.
- Products.
- Categories.
- Accounts.
- Posts.

## Phase 4 — Business Modules

- Bookstore.
- Sales.
- Order History.
- Inventory.

## Phase 5 — Analytics

- Visitors.
- Sessions.
- Traffic Sources.
- Country Analytics.
- Page Analytics.

## Phase 6 — Integration & Polish

- Persistence.
- Error handling.
- Responsive layouts.
- Accessibility.
- Performance.
- Tests.
- Documentation.

Complete and verify each phase before proceeding.

Do not skip requested pages.

If the task exceeds the available context or execution time, provide an accurate completion summary and clearly identify unfinished work.

---

# 23. REQUIRED DELIVERABLES

The completed project must include:

1. Working React application.
2. Modern Minimalist admin layout.
3. Functional page navigation.
4. Dashboard with charts.
5. Visitor analytics demo.
6. Product management.
7. Bookstore management.
8. Sales and order history.
9. User and role management.
10. Blog and content management.
11. Category management.
12. Media management.
13. Settings pages.
14. Audit log interface.
15. Complete reusable component library.
16. Interactive component showcase.
17. Realistic demo data.
18. Local demo persistence.
19. Light and dark themes.
20. Responsive layouts.
21. Reusable API abstraction.
22. Automated tests.
23. README documentation.

README must explain:

- How to install dependencies.
- How to start development server.
- How to run tests.
- How to build for production.
- How demo data works.
- How to reset demo data.
- How to connect a future ASP.NET Core backend.
- Which functionality is simulated.
- Which functionality requires a real backend.

---

# 24. ACCEPTANCE CRITERIA

The application is considered complete only when:

- All requested routes exist.
- Each page contains meaningful functionality.
- Navigation works.
- CRUD operations work in demo mode.
- Changes persist across refreshes.
- Tables support searching, sorting, filtering, and pagination where applicable.
- Forms validate correctly.
- Destructive actions require confirmation.
- Analytics demo displays consistent data.
- Every requested component has a working demonstration.
- Light and dark modes work.
- Responsive layouts work.
- TypeScript compilation succeeds.
- Production build succeeds.
- Automated tests have been executed and results reported.
- There are no known broken critical user flows.

A beautiful screenshot alone is not sufficient.

Avoid unfinished pages, fake success notifications, decorative buttons with no behavior, and placeholder components presented as completed features.

---

# 25. FINAL INSTRUCTIONS

Prioritize these principles:

**Design excellence. Engineering quality. Reusability. Maintainability. Real interactions.**

The result should feel like a premium, production-grade SaaS administration platform.

It must be visually refined enough for a professional commercial product and technically structured enough for long-term extension.

Use consistent spacing, typography, colors, icons, patterns, and interaction behavior across every module.

Use the same reusable component system across all pages.

Every component should have a clear responsibility and predictable behavior.

Every management module must demonstrate realistic workflows.

Do not oversimplify the implementation.

Do not replace requested features with static placeholders.

Do not add unnecessary visual complexity.

If an existing repository is provided, inspect its structure and conventions first, preserve working functionality, and integrate the new system without breaking existing code.

If starting from scratch, establish a clean architecture before implementing feature pages.

**Begin by inspecting the project, proposing the implementation architecture, and outlining the planned phases. Then implement the application phase by phase, verifying the result after each phase.**

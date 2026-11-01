# BiBi Studio

Website catalogue BiBi Studio với React/TanStack, API demo Express và admin demo local.

Hướng dẫn thống nhất cho người và agent: [develop, build, deploy, rollback](docs/build-and-deploy.md), [admin demo](docs/admin.md), [biên bản kiểm chứng local](docs/admin-acceptance.md). Dùng Node24, `npm ci`, `npm run dev` để chạy FE+BE cùng lúc; `npm run check` để kiểm tra và `npm run build` để tạo artifact. Admin tại `/admin`, lưu dữ liệu/ảnh trong trình duyệt; chưa nối database hoặc đăng nhập production.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bibistudio-2026.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a92fe95d-ba22-47c3-be74-9ed93eadfc00).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

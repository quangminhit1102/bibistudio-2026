export const profile = {
  id: "user-test",
  username: "user01",
  displayName: "Người dùng",
  email: null,
  roleIds: ["system-user"],
  roles: [{ id: "system-user", name: "User" }],
  permissions: ["customer_access.view"],
  fullAccess: false,
  isMaster: false,
  revision: 1,
};
export const grant = (token: string) => ({
  accessToken: token,
  expiresAt: "2099-01-01T00:00:00Z",
  profile,
});
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export const immediateLock = async <T>(work: () => Promise<T>) => work();

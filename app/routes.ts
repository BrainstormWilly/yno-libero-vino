import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("install", "routes/install.tsx"),
  route("uninstall", "routes/uninstall.tsx"),
  route("logout", "routes/logout.tsx"),
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("setup", "routes/app.setup.tsx"),
  ]),
  route("home", "routes/home.tsx"),
  route("shp/auth", "routes/shp.auth.tsx"),
  route("webhooks", "routes/webhooks._index.tsx", [
    route("c7", "routes/webhooks.c7.tsx"),
    route("shp", "routes/webhooks.shp.tsx"),
  ]),
] satisfies RouteConfig;

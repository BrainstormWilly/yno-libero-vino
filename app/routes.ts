import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("c7/auth", "routes/c7.auth.tsx"),
  route("shp/auth", "routes/shp.auth.tsx"),
  route("home", "routes/home.tsx"),
] satisfies RouteConfig;

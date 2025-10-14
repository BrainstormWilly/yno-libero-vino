import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("commerce7/auth", "routes/commerce7.auth.tsx"),
  route("shopify/auth", "routes/shopify.auth.tsx"),
  route("home", "routes/home.tsx"),
] satisfies RouteConfig;

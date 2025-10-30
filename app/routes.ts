import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("install", "routes/install.tsx"),
  route("uninstall", "routes/uninstall.tsx"),
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("setup", "routes/app.setup.tsx", [
      index("routes/app.setup._index.tsx"),
      route("tiers", "routes/app.setup.tiers.tsx"),
      route("tiers/:id", "routes/app.setup.tiers.$id.tsx", [
        index("routes/app.setup.tiers.$id._index.tsx"),
        route("promotions/new", "routes/app.setup.tiers.$id.promotions.new.tsx"),
        route("promotions/:promoId", "routes/app.setup.tiers.$id.promotions.$promoId.tsx"),
      ]),
      route("review", "routes/app.setup.review.tsx"),
    ]),
  ]),
  route("home", "routes/home.tsx"),
  route("shp/auth", "routes/shp.auth.tsx"),
  route("webhooks", "routes/webhooks._index.tsx", [
    route("c7", "routes/webhooks.c7.tsx"),
    route("shp", "routes/webhooks.shp.tsx"),
  ]),
  // API resource routes
  route("api/products", "routes/api.products.tsx"),
  route("api/collections", "routes/api.collections.tsx"),
] satisfies RouteConfig;

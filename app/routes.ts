import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("install", "routes/install.tsx"),
  route("uninstall", "routes/uninstall.tsx"),
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("members", "routes/app.members.tsx"),
    route("members/:id", "routes/app.members.$id.tsx"),
    route("members/new", "routes/app.members.new.tsx", [
      index("routes/app.members.new._index.tsx"),
      route("customer", "routes/app.members.new.customer.tsx"),
      route("address", "routes/app.members.new.address.tsx"),
      route("payment", "routes/app.members.new.payment.tsx"),
    ]),
    route("members/new/review", "routes/app.members.new_.review.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("settings/club_tiers", "routes/app.settings.club_tiers.tsx", [
      index("routes/app.settings.club_tiers._index.tsx"),
      route("new", "routes/app.settings.club_tiers.new.tsx"),
      route(":id", "routes/app.settings.club_tiers.$id.tsx", [
        index("routes/app.settings.club_tiers.$id._index.tsx"),
        route("promo/new", "routes/app.settings.club_tiers.$id.promo.new.tsx"),
        route("promo/:promo_id", "routes/app.settings.club_tiers.$id.promo.$promo_id.tsx"),
      ]),
    ]),
    route("settings/marketing", "routes/app.settings.marketing.tsx"),
    route("settings/communication", "routes/app.settings.communication.tsx"),
    route("settings/communication/templates", "routes/app.settings.communication.templates.tsx"),
    route("setup", "routes/app.setup.tsx", [
      index("routes/app.setup._index.tsx"),
      route("tiers", "routes/app.setup.tiers.tsx"),
      route("tiers/:id", "routes/app.setup.tiers.$id.tsx", [
        index("routes/app.setup.tiers.$id._index.tsx"),
        route("promotions/new", "routes/app.setup.tiers.$id.promotions.new.tsx"),
        route("promotions/:promoId", "routes/app.setup.tiers.$id.promotions.$promoId.tsx"),
      ]),
      route("review", "routes/app.setup.review.tsx"),
      route("marketing", "routes/app.setup.marketing.tsx"),
      route("communication", "routes/app.setup.communication.tsx", [
        index("routes/app.setup.communication._index.tsx"),
        route(":provider", "routes/app.setup.communication.$provider.tsx"),
        route("templates", "routes/app.setup.communication.templates.tsx"),
      ]),
    ]),
  ]),
  route("home", "routes/home.tsx"),
  route("shp/auth", "routes/shp.auth.tsx"),
  route("robots.txt", "routes/robots[.]txt.tsx"),
  route("sitemap.xml", "routes/sitemap[.]xml.tsx"),
  route("docs", "routes/docs.tsx", [
    route("sms-opt-in", "routes/docs.sms-opt-in.tsx"),
    route("sms-opt-in-demo", "routes/docs.sms-opt-in-demo.tsx"),
  ]),
  // API resource routes
  route("api/products", "routes/api.products.ts"),
  route("api/collections", "routes/api.collections.ts"),
  route("api/customers", "routes/api.customers.ts"),
  route("api/members", "routes/api.members.ts"),
  route("api/cron", "routes/api.cron.ts"),
  route("api/cron/sync", "routes/api.cron.sync.ts"),
  route("api/cron/monthly-status", "routes/api.cron.monthly-status.ts"),
  route("api/cron/monthly-status/queue", "routes/api.cron.monthly-status.queue.ts"),
  route("api/cron/expiration-warning/queue", "routes/api.cron.expiration-warning.queue.ts"),
  route("api/templates/preview", "routes/api.templates.preview.ts"),
  route("api/templates/download/:templateType", "routes/api.templates.download.$templateType.ts"),
  route("api/upload-sendgrid-image", "routes/api.upload-sendgrid-image.ts"),
  route("api/images/proxy", "routes/api.images.proxy.ts"),
  // API webhook routes (flat structure, matching api/cron pattern)
  route("api/webhooks", "routes/api.webhooks._index.tsx"), // UI page for webhook management
  route("api/webhooks/c7", "routes/api.webhooks.c7.tsx"),
  route("api/webhooks/shp", "routes/api.webhooks.shp.tsx"),
  route("api/webhooks/sms-reply", "routes/api.webhooks.sms-reply.tsx"),
] satisfies RouteConfig;

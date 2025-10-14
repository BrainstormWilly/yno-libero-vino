# Subdomain Routing - Quick Start Guide

## 🚀 What You Got

Your CRM access is now split into dedicated subdomains:

```
┌─────────────────────────────────────────────┐
│                                             │
│   c7.yourdomain.com  →  Commerce7 Only     │
│                                             │
│   shp.yourdomain.com →  Shopify Only       │
│                                             │
│   www.yourdomain.com →  All CRMs           │
│                                             │
└─────────────────────────────────────────────┘
```

## 🏃 Quick Local Testing (30 seconds)

1. **Edit your hosts file:**
   ```bash
   sudo nano /etc/hosts
   ```

2. **Add these lines:**
   ```
   127.0.0.1   c7.localhost
   127.0.0.1   shp.localhost
   ```

3. **Save and exit** (Ctrl+X, then Y, then Enter)

4. **Start your dev server:**
   ```bash
   npm run dev
   ```

5. **Test the subdomains:**
   - Open `http://c7.localhost:3000` → See Commerce7 only
   - Open `http://shp.localhost:3000` → See Shopify only
   - Open `http://localhost:3000` → See both

## 🌍 Production Setup (5 minutes)

### Step 1: DNS Configuration

Add these CNAME records in your DNS provider:

| Type  | Name | Value                      |
|-------|------|----------------------------|
| CNAME | c7   | your-app.herokuapp.com     |
| CNAME | shp  | your-app.herokuapp.com     |
| CNAME | www  | your-app.herokuapp.com     |

### Step 2: Heroku Domain Setup

```bash
# Add all domains to Heroku
heroku domains:add c7.yourdomain.com
heroku domains:add shp.yourdomain.com
heroku domains:add www.yourdomain.com

# Enable automatic SSL
heroku certs:auto:enable
```

### Step 3: Wait & Test

- Wait 5-10 minutes for DNS propagation
- Visit `https://c7.yourdomain.com`
- Visit `https://shp.yourdomain.com`

## 🎨 What Changed?

### Visual Changes

**On c7.yourdomain.com:**
- Purple gradient background 🟣
- Only Commerce7 connection shown
- Info banner: "You are on the Commerce7-specific subdomain"

**On shp.yourdomain.com:**
- Green gradient background 🟢
- Only Shopify connection shown
- Info banner: "You are on the Shopify-specific subdomain"

**On www.yourdomain.com:**
- Blue gradient background 🔵
- Both Commerce7 and Shopify shown
- No subdomain banner

### Technical Changes

1. **New utility:** `app/util/subdomain.ts`
   - Detects subdomain from request
   - Maps to CRM type

2. **Updated routes:**
   - Index route now subdomain-aware
   - Auth routes show warnings if wrong subdomain

3. **Smart filtering:**
   - CRM options filtered based on subdomain
   - Each subdomain gets its own branding

## 📚 Need More Details?

- **Full setup guide:** See [SUBDOMAIN_SETUP.md](SUBDOMAIN_SETUP.md)
- **Implementation details:** See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Main docs:** See [README.md](README.md)

## 🔧 Troubleshooting

### "It's not working locally"

1. Check `/etc/hosts` file has the entries
2. Clear browser cache
3. Make sure you're using the right port (usually 3000)

### "Production subdomain shows 404"

1. Wait longer (DNS can take up to 48 hours)
2. Check Heroku domains: `heroku domains`
3. Verify DNS records with: `dig c7.yourdomain.com`

### "Wrong CRM is showing"

1. Check the URL in browser address bar
2. Clear browser cache
3. Try incognito/private mode

## ✅ Verification Checklist

- [ ] Local `/etc/hosts` configured
- [ ] `npm run dev` runs without errors
- [ ] `http://c7.localhost:3000` shows Commerce7 only
- [ ] `http://shp.localhost:3000` shows Shopify only
- [ ] DNS CNAME records added
- [ ] Heroku domains added
- [ ] SSL certificates active
- [ ] Production URLs working

## 🎯 Next Steps

1. **Test locally** first with the quick setup above
2. **Configure production** DNS when ready
3. **Share URLs** with your Commerce7 and Shopify users:
   - Commerce7 users → `c7.yourdomain.com`
   - Shopify users → `shp.yourdomain.com`

That's it! Your subdomain routing is ready to go. 🎉


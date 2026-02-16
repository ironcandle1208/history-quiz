locals {
  # Cloudflare の Page Rule は優先度が衝突すると意図しない評価順になるため、
  # 動的ルールを先頭、静的ルールを後段に固定する。
  dynamic_bypass_rules = {
    for idx, path in var.dynamic_bypass_paths :
    path => {
      target   = "${var.public_hostname}${path}"
      priority = 10 + idx
    }
  }

  static_cache_rules = {
    for idx, path in var.static_cache_paths :
    path => {
      target   = "${var.public_hostname}${path}"
      priority = 100 + idx
    }
  }
}

resource "cloudflare_record" "public_origin" {
  zone_id = var.zone_id
  name    = var.public_hostname
  type    = "CNAME"
  value   = var.fly_origin_hostname
  proxied = var.proxied
  ttl     = 1
}

resource "cloudflare_zone_settings_override" "tls_baseline" {
  zone_id = var.zone_id

  settings {
    always_use_https = "on"
    ssl              = "strict"
  }
}

resource "cloudflare_page_rule" "dynamic_bypass" {
  for_each = local.dynamic_bypass_rules

  zone_id  = var.zone_id
  target   = each.value.target
  priority = each.value.priority
  status   = "active"

  actions {
    cache_level = "bypass"
  }
}

resource "cloudflare_page_rule" "static_cache" {
  for_each = local.static_cache_rules

  zone_id  = var.zone_id
  target   = each.value.target
  priority = each.value.priority
  status   = "active"

  actions {
    cache_level    = "cache_everything"
    edge_cache_ttl = var.static_cache_edge_ttl_seconds
  }
}


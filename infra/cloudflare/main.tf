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

  # 状態変更系 POST を共通式として定義し、WAF と Rate Limit の条件をそろえる。
  protected_post_expression = join(" or ", [
    "(http.request.method eq \"POST\" and http.request.uri.path eq \"/login\")",
    "(http.request.method eq \"POST\" and http.request.uri.path eq \"/quiz\")",
    "(http.request.method eq \"POST\" and http.request.uri.path eq \"/questions/new\")",
    "(http.request.method eq \"POST\" and http.request.uri.path matches \"^/questions/[^/]+/edit$\")",
  ])

  allowlist_condition = length(var.waf_allowlist_ip_cidrs) > 0 ? "not ip.src in {${join(" ", var.waf_allowlist_ip_cidrs)}}" : "true"

  # 各ルートの特性に合わせて初期しきい値を分ける。
  post_rate_limit_rules = {
    login = {
      description         = "login POST 連打を緩和する"
      expression          = "(http.request.method eq \"POST\" and http.request.uri.path eq \"/login\")"
      requests_per_period = var.rate_limit_login_requests_per_period
    }
    quiz = {
      description         = "quiz POST の過剰連投を緩和する"
      expression          = "(http.request.method eq \"POST\" and http.request.uri.path eq \"/quiz\")"
      requests_per_period = var.rate_limit_quiz_requests_per_period
    }
    question_new = {
      description         = "question create POST のスパム投稿を緩和する"
      expression          = "(http.request.method eq \"POST\" and http.request.uri.path eq \"/questions/new\")"
      requests_per_period = var.rate_limit_question_create_requests_per_period
    }
    question_edit = {
      description         = "question edit POST の過剰更新を緩和する"
      expression          = "(http.request.method eq \"POST\" and http.request.uri.path matches \"^/questions/[^/]+/edit$\")"
      requests_per_period = var.rate_limit_question_edit_requests_per_period
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

resource "cloudflare_ruleset" "custom_waf" {
  zone_id     = var.zone_id
  name        = "history-quiz-custom-waf"
  description = "Task36: Bot/悪性IP/異常パターンの最小 WAF セット"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  dynamic "rules" {
    for_each = length(var.waf_blocked_ip_cidrs) > 0 ? { blocked_ip = true } : {}
    content {
      action      = "block"
      enabled     = true
      description = "悪性IPを固定で遮断する"
      expression  = "(http.host eq \"${var.public_hostname}\" and ip.src in {${join(" ", var.waf_blocked_ip_cidrs)}})"
    }
  }

  rules {
    action      = "managed_challenge"
    enabled     = true
    description = "Bot系UAで状態変更POSTを試行したアクセスをチャレンジする"
    expression  = "(${local.protected_post_expression} and ${local.allowlist_condition} and not cf.client.bot and (http.user_agent eq \"\" or lower(http.user_agent) contains \"curl\" or lower(http.user_agent) contains \"python\" or lower(http.user_agent) contains \"sqlmap\" or lower(http.user_agent) contains \"nikto\"))"
  }

  rules {
    action      = "block"
    enabled     = true
    description = "SQLi/XSS/Path Traversal 由来の異常クエリを遮断する"
    expression  = "(${local.protected_post_expression} and ${local.allowlist_condition} and lower(http.request.uri.query) matches \"(?:union(?:\\+|\\s)+select|\\bor\\b(?:\\+|\\s)+1=1|<script|%3cscript|\\.\\./|%2e%2e%2f)\")"
  }
}

resource "cloudflare_ruleset" "post_rate_limit" {
  zone_id     = var.zone_id
  name        = "history-quiz-post-rate-limit"
  description = "Task36: 状態変更系POSTのレート制限"
  kind        = "zone"
  phase       = "http_ratelimit"

  dynamic "rules" {
    for_each = local.post_rate_limit_rules
    content {
      action      = "managed_challenge"
      enabled     = true
      description = rules.value.description
      expression  = "(${rules.value.expression} and ${local.allowlist_condition})"

      ratelimit {
        characteristics      = ["ip.src", "cf.colo.id"]
        period               = var.rate_limit_period_seconds
        requests_per_period  = rules.value.requests_per_period
        mitigation_timeout   = var.rate_limit_mitigation_timeout_seconds
      }
    }
  }
}

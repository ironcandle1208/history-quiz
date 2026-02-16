output "public_hostname" {
  description = "Cloudflare で公開するホスト名。"
  value       = var.public_hostname
}

output "fly_origin_hostname" {
  description = "Fly.io の参照元 Origin ホスト名。"
  value       = var.fly_origin_hostname
}

output "dynamic_bypass_rule_count" {
  description = "動的ページ向け Bypass Cache ルール数。"
  value       = length(cloudflare_page_rule.dynamic_bypass)
}

output "static_cache_rule_count" {
  description = "静的ページ向けキャッシュルール数。"
  value       = length(cloudflare_page_rule.static_cache)
}


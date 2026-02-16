variable "zone_id" {
  description = "Cloudflare Zone ID。"
  type        = string
}

variable "public_hostname" {
  description = "公開ホスト名（例: history-quiz.example.com）。"
  type        = string

  validation {
    condition     = !can(regex("^https?://", var.public_hostname))
    error_message = "public_hostname にはスキーマを含めず、ホスト名のみを指定してください。"
  }
}

variable "fly_origin_hostname" {
  description = "Fly.io Origin のホスト名（例: history-quiz-client.fly.dev）。"
  type        = string

  validation {
    condition     = !can(regex("^https?://", var.fly_origin_hostname))
    error_message = "fly_origin_hostname にはスキーマを含めず、ホスト名のみを指定してください。"
  }
}

variable "dynamic_bypass_paths" {
  description = "キャッシュをバイパスする動的パス。"
  type        = list(string)
  default = [
    "/quiz*",
    "/me*",
    "/login*",
    "/auth/*",
    "/questions*",
  ]
}

variable "static_cache_paths" {
  description = "静的配信用の基本キャッシュ対象パス。"
  type        = list(string)
  default = [
    "/build/*",
    "/assets/*",
  ]
}

variable "static_cache_edge_ttl_seconds" {
  description = "静的配信のエッジキャッシュ TTL（秒）。"
  type        = number
  default     = 14400
}

variable "proxied" {
  description = "公開 DNS レコードを Cloudflare Proxy 有効で作成するかどうか。"
  type        = bool
  default     = true
}

variable "waf_allowlist_ip_cidrs" {
  description = "WAF/Rate Limit の対象から除外する CIDR 一覧。誤検知時の一次緩和に使う。"
  type        = list(string)
  default     = []
}

variable "waf_blocked_ip_cidrs" {
  description = "常時ブロックする CIDR 一覧。悪性IPが確定した場合のみ追加する。"
  type        = list(string)
  default     = []
}

variable "rate_limit_login_requests_per_period" {
  description = "/login POST の期間内許容リクエスト数。"
  type        = number
  default     = 10
}

variable "rate_limit_quiz_requests_per_period" {
  description = "/quiz POST の期間内許容リクエスト数。"
  type        = number
  default     = 60
}

variable "rate_limit_question_create_requests_per_period" {
  description = "/questions/new POST の期間内許容リクエスト数。"
  type        = number
  default     = 20
}

variable "rate_limit_question_edit_requests_per_period" {
  description = "/questions/:id/edit POST の期間内許容リクエスト数。"
  type        = number
  default     = 20
}

variable "rate_limit_period_seconds" {
  description = "レート制限の観測期間（秒）。"
  type        = number
  default     = 60
}

variable "rate_limit_mitigation_timeout_seconds" {
  description = "レート制限発火後の緩和アクション継続時間（秒）。"
  type        = number
  default     = 120
}

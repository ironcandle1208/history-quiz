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


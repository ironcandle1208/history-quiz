package observability

import (
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
)

const defaultMaxLatencySamples = 512

// MethodMetricsSnapshot は RPC メソッド単位の集計結果を表す。
type MethodMetricsSnapshot struct {
	Method       string
	RequestCount uint64
	ErrorCount   uint64
	ErrorRate    float64
	P95LatencyMs float64
}

// CollectorSnapshot は全メソッド分の可観測性スナップショットを表す。
type CollectorSnapshot struct {
	CollectedAt time.Time
	Methods     []MethodMetricsSnapshot
}

type methodMetricsState struct {
	requestCount   uint64
	errorCount     uint64
	latencySamples []float64
}

// Collector は RPC 件数・エラー率・p95 レイテンシをメモリ内に集計する。
type Collector struct {
	mu                sync.Mutex
	maxLatencySamples int
	byMethod          map[string]*methodMetricsState
}

// NewCollector は可観測性メトリクスの Collector を生成する。
func NewCollector(maxLatencySamples int) *Collector {
	if maxLatencySamples <= 0 {
		maxLatencySamples = defaultMaxLatencySamples
	}

	return &Collector{
		maxLatencySamples: maxLatencySamples,
		byMethod:          map[string]*methodMetricsState{},
	}
}

// RecordRPC は 1 回分の RPC 実行結果を集計に反映する。
func (c *Collector) RecordRPC(method string, code codes.Code, latency time.Duration) {
	if c == nil {
		return
	}

	normalizedMethod := normalizeMethodName(method)
	latencyMs := float64(latency.Microseconds()) / 1000.0

	c.mu.Lock()
	defer c.mu.Unlock()

	state, ok := c.byMethod[normalizedMethod]
	if !ok {
		state = &methodMetricsState{}
		c.byMethod[normalizedMethod] = state
	}

	state.requestCount++
	if isErrorCode(code) {
		state.errorCount++
	}
	state.latencySamples = appendLatencySample(state.latencySamples, latencyMs, c.maxLatencySamples)
}

// Snapshot は現時点の集計結果をコピーして返す。
func (c *Collector) Snapshot() CollectorSnapshot {
	if c == nil {
		return CollectorSnapshot{
			CollectedAt: time.Now().UTC(),
		}
	}

	type copiedState struct {
		method         string
		requestCount   uint64
		errorCount     uint64
		latencySamples []float64
	}

	c.mu.Lock()
	copied := make([]copiedState, 0, len(c.byMethod))
	for method, state := range c.byMethod {
		copied = append(copied, copiedState{
			method:         method,
			requestCount:   state.requestCount,
			errorCount:     state.errorCount,
			latencySamples: append([]float64(nil), state.latencySamples...),
		})
	}
	c.mu.Unlock()

	methods := make([]MethodMetricsSnapshot, 0, len(copied))
	for _, state := range copied {
		errorRate := 0.0
		if state.requestCount > 0 {
			errorRate = float64(state.errorCount) / float64(state.requestCount)
		}

		methods = append(methods, MethodMetricsSnapshot{
			Method:       state.method,
			RequestCount: state.requestCount,
			ErrorCount:   state.errorCount,
			ErrorRate:    errorRate,
			P95LatencyMs: calculateP95(state.latencySamples),
		})
	}

	sort.Slice(methods, func(i, j int) bool {
		return methods[i].Method < methods[j].Method
	})

	return CollectorSnapshot{
		CollectedAt: time.Now().UTC(),
		Methods:     methods,
	}
}

// normalizeMethodName は空値や余計な空白を除去してメソッド名を正規化する。
func normalizeMethodName(method string) string {
	trimmed := strings.TrimSpace(method)
	if trimmed == "" {
		return "unknown"
	}
	return trimmed
}

// isErrorCode は gRPC status code をエラー扱いにするか判定する。
func isErrorCode(code codes.Code) bool {
	return code != codes.OK
}

// appendLatencySample は固定長のサンプル窓へレイテンシを追加する。
// 混同しやすい点として、古いサンプルを先頭から捨てることでメモリ上限を固定している。
func appendLatencySample(samples []float64, latencyMs float64, maxSamples int) []float64 {
	if maxSamples <= 0 {
		return []float64{latencyMs}
	}

	if len(samples) < maxSamples {
		return append(samples, latencyMs)
	}

	copy(samples, samples[1:])
	samples[len(samples)-1] = latencyMs
	return samples
}

// calculateP95 は与えられたレイテンシサンプルから p95 を求める。
func calculateP95(samples []float64) float64 {
	if len(samples) == 0 {
		return 0
	}

	copied := append([]float64(nil), samples...)
	sort.Float64s(copied)

	// p95 の定義は ceil(N*0.95) 番目（1始まり）を採用する。
	index := int(math.Ceil(float64(len(copied))*0.95)) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(copied) {
		index = len(copied) - 1
	}
	return copied[index]
}
